"""
ZorvixHost Telegram Bot - LXC Container Management System
A Telegram-based VPS management bot for LXC containers

Based on the Discord version, adapted for Telegram's interaction model
"""

import asyncio
import subprocess
import json
from datetime import datetime
import shlex
import logging
import shutil
import os
from typing import Optional, Dict, Any, List
import threading
import time

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    BotCommand,
    BotCommandScopeAllPrivateChats
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    CallbackContext
)

# ============================================================================
# CORE CONFIGURATION
# ============================================================================

# Bot configuration - HARDCODED VALUES
TELEGRAM_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN_HERE"
MAIN_ADMIN_ID = 1352603271285706784
DEFAULT_STORAGE_POOL = "default"
CPU_THRESHOLD = 90
RAM_THRESHOLD = 90
CHECK_INTERVAL = 600

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('telegram_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('zorvixhost_telegram_bot')

# Check if lxc command is available
if not shutil.which("lxc"):
    logger.error("LXC command not found. Please ensure LXC is installed.")
    raise SystemExit("LXC command not found. Please ensure LXC is installed.")

# ============================================================================
# GLOBAL STATE
# ============================================================================

class ZorvixHostBot:
    def __init__(self):
        self.vps_data = {}
        self.admin_data = {"admins": []}
        self.cpu_monitor_active = True
        self.start_time = datetime.now()

bot = ZorvixHostBot()

# ============================================================================
# MESSAGE FORMATTING
# ============================================================================

def format_bold(text: str) -> str:
    """Format text as bold in Telegram"""
    return f"*{text}*"

def format_code(text: str) -> str:
    """Format text as code in Telegram"""
    return f"`{text}`"

def format_code_block(text: str) -> str:
    """Format text as code block in Telegram"""
    return f"```\n{text}\n```"

def format_section(title: str, content: str) -> str:
    """Format a section with title"""
    return f"{format_bold(title)}\n{content}"

def truncate_text(text: str, max_length: int = 4096) -> str:
    """Truncate text to max_length characters"""
    if not text:
        return text
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."

# ============================================================================
# DATA MANAGEMENT
# ============================================================================

def load_vps_data():
    try:
        with open('vps_data.json', 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logger.warning("vps_data.json not found or corrupted, initializing empty data")
        return {}

def load_admin_data():
    try:
        with open('admin_data.json', 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logger.warning("admin_data.json not found or corrupted, initializing with main admin")
        return {"admins": []}

def save_data():
    try:
        with open('vps_data.json', 'w') as f:
            json.dump(bot.vps_data, f, indent=4)
        with open('admin_data.json', 'w') as f:
            json.dump(bot.admin_data, f, indent=4)
        logger.info("Data saved successfully")
    except Exception as e:
        logger.error(f"Error saving data: {e}")

# ============================================================================
# PERMISSION CHECKS
# ============================================================================

def is_admin(user_id: int) -> bool:
    """Check if user is an admin"""
    return user_id == MAIN_ADMIN_ID or str(user_id) in bot.admin_data.get("admins", [])

def is_main_admin(user_id: int) -> bool:
    """Check if user is the main admin"""
    return user_id == MAIN_ADMIN_ID

# ============================================================================
# LXC COMMAND EXECUTION
# ============================================================================

async def execute_lxc(command: str, timeout: int = 120) -> str:
    """Execute LXC command with timeout and error handling"""
    try:
        cmd = shlex.split(command)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)

        if proc.returncode != 0:
            error = stderr.decode().strip() if stderr else "Command execution failed"
            raise Exception(error)

        return stdout.decode().strip() if stdout else "Success"
    except asyncio.TimeoutError:
        logger.error(f"LXC command timed out: {command}")
        raise Exception(f"Command timeout after {timeout} seconds")
    except Exception as e:
        logger.error(f"LXC Error: {command} - {str(e)}")
        raise

# ============================================================================
# HOST MONITORING SYSTEM
# ============================================================================

def get_cpu_usage() -> float:
    """Get current CPU usage percentage"""
    try:
        result = subprocess.run(['top', '-bn1'], capture_output=True, text=True)
        output = result.stdout
        
        for line in output.split('\n'):
            if '%Cpu(s):' in line:
                words = line.split()
                for i, word in enumerate(words):
                    if word == 'id,':
                        idle_str = words[i-1].rstrip(',')
                        try:
                            idle = float(idle_str)
                            usage = 100.0 - idle
                            return usage
                        except ValueError:
                            pass
                break
        return 0.0
    except Exception as e:
        logger.error(f"Error getting CPU usage: {e}")
        return 0.0

def cpu_monitor():
    """Monitor CPU usage and stop all VPS if threshold is exceeded"""
    while bot.cpu_monitor_active:
        try:
            cpu_usage = get_cpu_usage()
            logger.info(f"Current CPU usage: {cpu_usage}%")
            
            if cpu_usage > CPU_THRESHOLD:
                logger.warning(f"CPU usage ({cpu_usage}%) exceeded threshold ({CPU_THRESHOLD}%). Initiating emergency shutdown.")
                
                try:
                    subprocess.run(['lxc', 'stop', '--all', '--force'], check=True)
                    logger.info("All instances powered down due to critical resource levels")
                    
                    for user_id, vps_list in bot.vps_data.items():
                        for vps in vps_list:
                            if vps.get('status') == 'running':
                                vps['status'] = 'stopped'
                    save_data()
                except Exception as e:
                    logger.error(f"Error during emergency shutdown: {e}")
            
            time.sleep(60)
        except Exception as e:
            logger.error(f"Error in CPU monitor: {e}")
            time.sleep(60)

# ============================================================================
# CONTAINER STATISTICS
# ============================================================================

async def get_container_status(container_name: str) -> str:
    """Get the status of the LXC container"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "lxc", "info", container_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        output = stdout.decode()
        for line in output.splitlines():
            if line.startswith("Status: "):
                return line.split(": ", 1)[1].strip()
        return "Unknown"
    except Exception:
        return "Unknown"

async def get_container_cpu(container_name: str) -> str:
    """Get CPU usage inside the container as string"""
    usage = await get_container_cpu_pct(container_name)
    return f"{usage:.1f}%"

async def get_container_cpu_pct(container_name: str) -> float:
    """Get CPU usage percentage inside the container as float"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "lxc", "exec", container_name, "--", "top", "-bn1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        output = stdout.decode()
        for line in output.splitlines():
            if '%Cpu(s):' in line:
                words = line.split()
                for i, word in enumerate(words):
                    if word == 'id,':
                        idle_str = words[i-1].rstrip(',')
                        try:
                            idle = float(idle_str)
                            usage = 100.0 - idle
                            return usage
                        except ValueError:
                            pass
                break
        return 0.0
    except Exception as e:
        logger.error(f"Error getting CPU for {container_name}: {e}")
        return 0.0

async def get_container_memory(container_name: str) -> str:
    """Get memory usage inside the container"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "lxc", "exec", container_name, "--", "free", "-m",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        lines = stdout.decode().splitlines()
        if len(lines) > 1:
            parts = lines[1].split()
            total = int(parts[1])
            used = int(parts[2])
            usage_pct = (used / total * 100) if total > 0 else 0
            return f"{used}/{total} MB ({usage_pct:.1f}%)"
        return "Unknown"
    except Exception:
        return "Unknown"

async def get_container_ram_pct(container_name: str) -> float:
    """Get RAM usage percentage inside the container as float"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "lxc", "exec", container_name, "--", "free", "-m",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        lines = stdout.decode().splitlines()
        if len(lines) > 1:
            parts = lines[1].split()
            total = int(parts[1])
            used = int(parts[2])
            usage_pct = (used / total * 100) if total > 0 else 0
            return usage_pct
        return 0.0
    except Exception as e:
        logger.error(f"Error getting RAM for {container_name}: {e}")
        return 0.0

async def get_container_disk(container_name: str) -> str:
    """Get disk usage inside the container"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "lxc", "exec", container_name, "--", "df", "-h", "/",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        lines = stdout.decode().splitlines()
        for line in lines:
            if '/dev/' in line and ' /' in line:
                parts = line.split()
                if len(parts) >= 5:
                    used = parts[2]
                    size = parts[1]
                    perc = parts[4]
                    return f"{used}/{size} ({perc})"
        return "Unknown"
    except Exception:
        return "Unknown"

def get_uptime() -> str:
    """Get host uptime"""
    try:
        result = subprocess.run(['uptime'], capture_output=True, text=True)
        return result.stdout.strip()
    except Exception:
        return "Unknown"

# ============================================================================
# VPS MONITORING TASK
# ============================================================================

async def vps_monitor():
    """Monitor each VPS for high CPU/RAM usage"""
    while True:
        try:
            for user_id, vps_list in bot.vps_data.items():
                for vps in vps_list:
                    if vps.get('status') == 'running' and not vps.get('suspended', False):
                        container = vps['container_name']
                        cpu = await get_container_cpu_pct(container)
                        ram = await get_container_ram_pct(container)
                        if cpu > CPU_THRESHOLD or ram > RAM_THRESHOLD:
                            reason = f"Resource consumption exceeded thresholds: CPU {cpu:.1f}%, RAM {ram:.1f}%"
                            logger.warning(f"Suspending {container}: {reason}")
                            try:
                                await execute_lxc(f"lxc stop {container}")
                                vps['status'] = 'suspended'
                                vps['suspended'] = True
                                if 'suspension_history' not in vps:
                                    vps['suspension_history'] = []
                                vps['suspension_history'].append({
                                    'time': datetime.now().isoformat(),
                                    'reason': reason,
                                    'by': 'ZorvixHost Auto-System'
                                })
                                save_data()
                            except Exception as e:
                                logger.error(f"Failed to suspend {container}: {e}")
            await asyncio.sleep(CHECK_INTERVAL)
        except Exception as e:
            logger.error(f"VPS monitor error: {e}")
            await asyncio.sleep(60)

# ============================================================================
# INLINE KEYBOARD HELPERS
# ============================================================================

def create_vps_select_keyboard(vps_list: List[Dict], callback_prefix: str = "vps_select") -> InlineKeyboardMarkup:
    """Create inline keyboard for VPS selection"""
    keyboard = []
    for i, vps in enumerate(vps_list):
        status = vps.get('status', 'unknown').upper()
        if vps.get('suspended', False):
            status += " (ISOLATED)"
        config = vps.get('config', 'Custom')
        label = f"#{i+1} - {vps['container_name']} [{status}]"
        keyboard.append([InlineKeyboardButton(label, callback_data=f"{callback_prefix}:{i}")])
    return InlineKeyboardMarkup(keyboard)

def create_vps_control_keyboard(vps_index: int, is_owner: bool = True, is_admin: bool = False) -> InlineKeyboardMarkup:
    """Create inline keyboard for VPS control"""
    keyboard = []
    
    # First row: Power controls
    row1 = [
        InlineKeyboardButton("▶️ Start", callback_data=f"vps_start:{vps_index}"),
        InlineKeyboardButton("⏸️ Stop", callback_data=f"vps_stop:{vps_index}")
    ]
    keyboard.append(row1)
    
    # Second row: Other controls
    row2 = [
        InlineKeyboardButton("📊 Stats", callback_data=f"vps_stats:{vps_index}"),
        InlineKeyboardButton("🔑 SSH", callback_data=f"vps_ssh:{vps_index}")
    ]
    keyboard.append(row2)
    
    # Third row: Reinstall (owner only)
    if is_owner and not is_admin:
        row3 = [
            InlineKeyboardButton("🔄 Reinstall", callback_data=f"vps_reinstall:{vps_index}")
        ]
        keyboard.append(row3)
    
    # Fourth row: Back
    row4 = [
        InlineKeyboardButton("⬅️ Back", callback_data="vps_back")
    ]
    keyboard.append(row4)
    
    return InlineKeyboardMarkup(keyboard)

def create_confirm_keyboard(action: str, vps_index: int) -> InlineKeyboardMarkup:
    """Create confirmation keyboard"""
    keyboard = [
        [
            InlineKeyboardButton("✅ Confirm", callback_data=f"confirm_{action}:{vps_index}"),
            InlineKeyboardButton("❌ Cancel", callback_data=f"cancel_{action}:{vps_index}")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

# ============================================================================
# MESSAGE HELPERS
# ============================================================================

async def send_message(update: Update, text: str, reply_markup=None, parse_mode='Markdown'):
    """Helper to send a message"""
    if update.callback_query:
        try:
            if reply_markup:
                await update.callback_query.message.edit_text(
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode=parse_mode
                )
            else:
                await update.callback_query.message.edit_text(
                    text=text,
                    parse_mode=parse_mode
                )
        except Exception as e:
            logger.error(f"Error editing message: {e}")
    elif update.message:
        try:
            await update.message.reply_text(
                text=text,
                reply_markup=reply_markup,
                parse_mode=parse_mode
            )
        except Exception as e:
            logger.error(f"Error sending message: {e}")

# ============================================================================
# VPS MANAGEMENT HELPERS
# ============================================================================

async def format_vps_info(vps: Dict, index: int) -> str:
    """Format VPS information for display"""
    container_name = vps['container_name']
    status = vps.get('status', 'unknown').upper()
    suspended = vps.get('suspended', False)
    
    if suspended:
        status += " (ISOLATED)"
    
    # Get live stats
    lxc_status = await get_container_status(container_name)
    cpu_usage = await get_container_cpu(container_name)
    memory_usage = await get_container_memory(container_name)
    disk_usage = await get_container_disk(container_name)
    
    text = f"{format_bold('🖥️ Instance Management')} #{index + 1}\n\n"
    text += f"{format_section('Container:', format_code(container_name))}\n"
    text += f"{format_section('Status:', format_code(status))}\n"
    text += f"{format_section('LXC Status:', format_code(lxc_status))}\n\n"
    
    text += f"{format_bold('📊 Resource Allocation')}\n"
    text += f"• Configuration: {format_code(vps.get('config', 'Custom'))}\n"
    text += f"• Memory: {format_code(vps['ram'])}\n"
    text += f"• CPU: {format_code(vps['cpu'])}\n"
    text += f"• Storage: {format_code(vps['storage'])}\n\n"
    
    text += f"{format_bold('📈 Live Metrics')}\n"
    text += f"• CPU: {format_code(cpu_usage)}\n"
    text += f"• Memory: {format_code(memory_usage)}\n"
    text += f"• Disk: {format_code(disk_usage)}\n\n"
    
    if suspended:
        text += f"{format_bold('⚠️ Isolated')}\n"
        text += "This instance has been isolated due to policy violations or resource limits.\n\n"
    
    text += f"{format_bold('🎮 Controls')}\n"
    text += "Use the buttons below to manage this instance."
    
    return truncate_text(text)

async def format_vps_list(vps_list: List[Dict]) -> str:
    """Format VPS list for display"""
    if not vps_list:
        return format_bold("❌ No Allocated Instances")
    
    text = f"{format_bold('📋 Your Instances')}\n\n"
    
    for i, vps in enumerate(vps_list):
        status = vps.get('status', 'unknown').upper()
        if vps.get('suspended', False):
            status += " (ISOLATED)"
        config = vps.get('config', 'Custom')
        
        text += f"{format_bold(f'Instance #{i+1}:')} {format_code(vps['container_name'])}\n"
        text += f"  • Status: {format_code(status)}\n"
        text += f"  • Config: {format_code(config)}\n\n"
    
    text += f"{format_bold('💡 Tip:')} Use /manage to access the control panel."
    return truncate_text(text)

# ============================================================================
# TELEGRAM COMMAND HANDLERS
# ============================================================================

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user_id = update.effective_user.id
    
    welcome_text = f"""
{format_bold('🚀 Welcome to ZorvixHost!')}

{format_section('Infrastructure Management System', 'Manage your LXC containers through Telegram')}

{format_bold('📋 Available Commands:')}

{format_code('/start')} - Show this welcome message
{format_code('/ping')} - Check system latency
{format_code('/uptime')} - Display host uptime
{format_code('/myvps')} - List your instances
{format_code('/manage')} - Access control panel
{format_code('/help')} - Show command documentation
"""
    
    if is_admin(user_id):
        welcome_text += f"\n{format_bold('🛡️ Administrator Commands:')}\n"
        welcome_text += f"{format_code('/create')} - Provision new instance\n"
        welcome_text += f"{format_code('/delete_vps')} - Decommission instance\n"
        welcome_text += f"{format_code('/serverstats')} - Show infrastructure stats\n"
        welcome_text += f"{format_code('/restart_vps')} - Restart instance\n"
        welcome_text += f"{format_code('/suspend_vps')} - Isolate instance\n"
        welcome_text += f"{format_code('/unsuspend_vps')} - Remove isolation\n"
    
    if is_main_admin(user_id):
        welcome_text += f"\n{format_bold('👑 Main Admin Commands:')}\n"
        welcome_text += f"{format_code('/admin_add')} - Add administrator\n"
        welcome_text += f"{format_code('/admin_remove')} - Remove administrator\n"
        welcome_text += f"{format_code('/admin_list')} - List administrators\n"
    
    await update.message.reply_text(welcome_text, parse_mode='Markdown')

async def ping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /ping command"""
    start_time = time.time()
    await update.message.reply_text("Pinging...", parse_mode='Markdown')
    end_time = time.time()
    latency = round((end_time - start_time) * 1000)
    
    text = f"{format_bold('🏓 System Responsiveness')}\n\n"
    text += f"Bot latency: {format_code(f'{latency}ms')}"
    await update.message.reply_text(text, parse_mode='Markdown')

async def uptime_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /uptime command"""
    up = get_uptime()
    
    text = f"{format_bold('⏱️ System Uptime')}\n\n"
    text += format_code_block(up)
    await update.message.reply_text(text, parse_mode='Markdown')

async def myvps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /myvps command"""
    user_id = str(update.effective_user.id)
    vps_list = bot.vps_data.get(user_id, [])
    
    text = await format_vps_list(vps_list)
    await update.message.reply_text(text, parse_mode='Markdown')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    user_id = update.effective_user.id
    
    text = f"{format_bold('📚 Command Documentation')}\n\n"
    
    text += f"{format_bold('👤 User Commands:')}\n"
    user_commands = [
        ("/start", "Show welcome message"),
        ("/ping", "Check system latency"),
        ("/uptime", "Display host uptime"),
        ("/myvps", "List your instances"),
        ("/manage", "Access control panel"),
        ("/help", "Show this help")
    ]
    for cmd, desc in user_commands:
        text += f"• {format_code(cmd)} - {desc}\n"
    
    if is_admin(user_id):
        text += f"\n{format_bold('🛡️ Administrator Commands:')}\n"
        admin_commands = [
            ("/create", "Provision new instance"),
            ("/delete_vps", "Decommission instance"),
            ("/serverstats", "Show infrastructure stats"),
            ("/restart_vps", "Restart instance"),
            ("/suspend_vps", "Isolate instance"),
            ("/unsuspend_vps", "Remove isolation")
        ]
        for cmd, desc in admin_commands:
            text += f"• {format_code(cmd)} - {desc}\n"
    
    if is_main_admin(user_id):
        text += f"\n{format_bold('👑 Main Administrator Commands:')}\n"
        admin_commands = [
            ("/admin_add", "Add administrator"),
            ("/admin_remove", "Remove administrator"),
            ("/admin_list", "List administrators")
        ]
        for cmd, desc in admin_commands:
            text += f"• {format_code(cmd)} - {desc}\n"
    
    await update.message.reply_text(text, parse_mode='Markdown')

# ============================================================================
# MANAGE COMMAND - CONTROL PANEL
# ============================================================================

async def manage_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /manage command - Show VPS control panel"""
    user_id = str(update.effective_user.id)
    
    # Check if managing other user (admin only)
    if context.args and len(context.args) > 0:
        if not is_admin(update.effective_user.id):
            await update.message.reply_text(
                format_bold("❌ Administrative Privileges Required"),
                parse_mode='Markdown'
            )
            return
        
        try:
            target_user_id = context.args[0]
            vps_list = bot.vps_data.get(target_user_id, [])
            if not vps_list:
                await update.message.reply_text(
                    format_bold("❌ No Allocations Found"),
                    parse_mode='Markdown'
                )
                return
            
            # Store target user in context for callback handling
            context.user_data['managing_user'] = target_user_id
            context.user_data['is_admin_managing'] = True
            
            text = f"{format_bold('🔧 Administrative Management')}\n\n"
            text += f"Managing instances for user ID: {format_code(target_user_id)}\n\n"
            text += "Select an instance to manage:"
            
            keyboard = create_vps_select_keyboard(vps_list, "admin_vps_select")
            await update.message.reply_text(text, reply_markup=keyboard, parse_mode='Markdown')
        except Exception as e:
            await update.message.reply_text(
                f"{format_bold('❌ Error')}: {str(e)}",
                parse_mode='Markdown'
            )
    else:
        # Manage own instances
        vps_list = bot.vps_data.get(user_id, [])
        if not vps_list:
            text = format_bold("❌ No Allocated Instances")
            text += "\n\nContact ZorvixHost administration for instance allocation."
            await update.message.reply_text(text, parse_mode='Markdown')
            return
        
        context.user_data['managing_user'] = user_id
        context.user_data['is_admin_managing'] = False
        
        if len(vps_list) == 1:
            # Single instance, show directly
            context.user_data['selected_vps_index'] = 0
            text = await format_vps_info(vps_list[0], 0)
            keyboard = create_vps_control_keyboard(0, is_owner=True, is_admin=False)
            await update.message.reply_text(text, reply_markup=keyboard, parse_mode='Markdown')
        else:
            # Multiple instances, show selection
            text = f"{format_bold('🖥️ Instance Management')}\n\n"
            text += "Select an instance to manage:"
            keyboard = create_vps_select_keyboard(vps_list)
            await update.message.reply_text(text, reply_markup=keyboard, parse_mode='Markdown')

# ============================================================================
# CALLBACK QUERY HANDLERS
# ============================================================================

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle all callback queries"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    parts = data.split(':')
    action = parts[0]
    
    if action == "vps_select":
        await handle_vps_select(update, context, int(parts[1]))
    elif action == "admin_vps_select":
        await handle_admin_vps_select(update, context, int(parts[1]))
    elif action == "vps_back":
        await handle_vps_back(update, context)
    elif action == "vps_start":
        await handle_vps_start(update, context, int(parts[1]))
    elif action == "vps_stop":
        await handle_vps_stop(update, context, int(parts[1]))
    elif action == "vps_stats":
        await handle_vps_stats(update, context, int(parts[1]))
    elif action == "vps_ssh":
        await handle_vps_ssh(update, context, int(parts[1]))
    elif action == "vps_reinstall":
        await handle_vps_reinstall(update, context, int(parts[1]))
    elif action == "confirm_reinstall":
        await handle_confirm_reinstall(update, context, int(parts[1]))
    elif action == "cancel_reinstall":
        await handle_cancel_reinstall(update, context, int(parts[1]))

async def handle_vps_select(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle VPS selection"""
    user_id = str(update.effective_user.id)
    vps_list = bot.vps_data.get(user_id, [])
    
    if vps_index >= len(vps_list):
        await update.callback_query.message.reply_text("Invalid instance selection.")
        return
    
    context.user_data['selected_vps_index'] = vps_index
    text = await format_vps_info(vps_list[vps_index], vps_index)
    keyboard = create_vps_control_keyboard(vps_index, is_owner=True, is_admin=False)
    await send_message(update, text, keyboard)

async def handle_admin_vps_select(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle admin VPS selection"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        await update.callback_query.message.reply_text("Error: No target user selected.")
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        await update.callback_query.message.reply_text("Invalid instance selection.")
        return
    
    context.user_data['selected_vps_index'] = vps_index
    text = await format_vps_info(vps_list[vps_index], vps_index)
    keyboard = create_vps_control_keyboard(vps_index, is_owner=False, is_admin=True)
    await send_message(update, text, keyboard)

async def handle_vps_back(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle back button"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        await update.callback_query.message.reply_text("Error: No target user selected.")
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if not vps_list:
        text = format_bold("❌ No Allocated Instances")
        await send_message(update, text)
        return
    
    text = f"{format_bold('🖥️ Instance Management')}\n\n"
    text += "Select an instance to manage:"
    keyboard = create_vps_select_keyboard(vps_list, "admin_vps_select" if context.user_data.get('is_admin_managing') else "vps_select")
    await send_message(update, text, keyboard)

async def handle_vps_start(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle VPS start"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    container_name = vps['container_name']
    
    try:
        await execute_lxc(f"lxc start {container_name}")
        vps['status'] = 'running'
        vps['suspended'] = False
        save_data()
        
        text = f"{format_bold('✅ Instance Powered On')}\n\n"
        text += f"{format_code(container_name)} is now operational."
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')
        
        # Refresh the control panel
        new_text = await format_vps_info(vps, vps_index)
        keyboard = create_vps_control_keyboard(vps_index, is_owner=not context.user_data.get('is_admin_managing'), is_admin=context.user_data.get('is_admin_managing'))
        await send_message(update, new_text, keyboard)
    except Exception as e:
        text = f"{format_bold('❌ Power On Failed')}\n\n"
        text += f"Error: {format_code(str(e))}"
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')

async def handle_vps_stop(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle VPS stop"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    container_name = vps['container_name']
    
    try:
        await execute_lxc(f"lxc stop {container_name}", timeout=120)
        vps['status'] = 'stopped'
        vps['suspended'] = False
        save_data()
        
        text = f"{format_bold('✅ Instance Powered Off')}\n\n"
        text += f"{format_code(container_name)} has been shut down."
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')
        
        # Refresh the control panel
        new_text = await format_vps_info(vps, vps_index)
        keyboard = create_vps_control_keyboard(vps_index, is_owner=not context.user_data.get('is_admin_managing'), is_admin=context.user_data.get('is_admin_managing'))
        await send_message(update, new_text, keyboard)
    except Exception as e:
        text = f"{format_bold('❌ Power Off Failed')}\n\n"
        text += f"Error: {format_code(str(e))}"
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')

async def handle_vps_stats(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle VPS stats"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    container_name = vps['container_name']
    
    status = await get_container_status(container_name)
    cpu_usage = await get_container_cpu(container_name)
    memory_usage = await get_container_memory(container_name)
    disk_usage = await get_container_disk(container_name)
    
    text = f"{format_bold('📊 Live Resource Metrics')}\n\n"
    text += f"Real-time statistics for {format_code(container_name)}\n\n"
    text += f"{format_section('Status:', format_code(status.upper()))}\n"
    text += f"{format_section('CPU Utilization:', format_code(cpu_usage))}\n"
    text += f"{format_section('Memory Consumption:', format_code(memory_usage))}\n"
    text += f"{format_section('Disk Usage:', format_code(disk_usage))}"
    
    await update.callback_query.message.reply_text(text, parse_mode='Markdown')

async def handle_vps_ssh(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle VPS SSH access"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    container_name = vps['container_name']
    
    if vps.get('suspended', False):
        text = f"{format_bold('❌ Access Denied')}\n\n"
        text += "Cannot establish SSH connection to isolated instance."
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')
        return
    
    try:
        # Check if tmate is installed
        check_proc = await asyncio.create_subprocess_exec(
            "lxc", "exec", container_name, "--", "which", "tmate",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await check_proc.communicate()
        
        if check_proc.returncode != 0:
            await execute_lxc(f"lxc exec {container_name} -- sudo apt-get update -y")
            await execute_lxc(f"lxc exec {container_name} -- sudo apt-get install tmate -y")
        
        session_name = f"zorvix-session-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        await execute_lxc(f"lxc exec {container_name} -- tmate -S /tmp/{session_name}.sock new-session -d")
        await asyncio.sleep(3)
        
        ssh_proc = await asyncio.create_subprocess_exec(
            "lxc", "exec", container_name, "--", "tmate", "-S", f"/tmp/{session_name}.sock", "display", "-p", "#{tmate_ssh}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await ssh_proc.communicate()
        ssh_url = stdout.decode().strip() if stdout else None
        
        if ssh_url:
            text = f"{format_bold('🔐 Secure SSH Access')}\n\n"
            text += f"SSH connection established for instance {format_code(container_name)}:\n\n"
            text += f"{format_code_block(ssh_url)}\n\n"
            text += f"{format_bold('⚠️ Security Notice:')}\n"
            text += "• This connection is temporary and secure\n"
            text += "• Do not share this link\n\n"
            text += f"Session ID: {format_code(session_name)}"
            await update.callback_query.message.reply_text(text, parse_mode='Markdown')
        else:
            error_msg = stderr.decode().strip() if stderr else "Connection generation failed"
            text = f"{format_bold('❌ SSH Generation Failed')}\n\n"
            text += f"Error: {format_code(error_msg)}"
            await update.callback_query.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        text = f"{format_bold('❌ SSH Error')}\n\n"
        text += f"Connection error: {format_code(str(e))}"
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')

async def handle_vps_reinstall(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle VPS reinstall - show confirmation"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    container_name = vps['container_name']
    
    if vps.get('suspended', False):
        text = f"{format_bold('❌ Cannot Reinstall')}\n\n"
        text += "Remove isolation status before reinstallation."
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')
        return
    
    text = f"{format_bold('⚠️ Reinstallation Warning')}\n\n"
    text += f"{format_bold('CRITICAL NOTICE:')} This operation will permanently erase all data on instance {format_code(container_name)} and deploy a fresh Ubuntu 22.04 installation.\n\n"
    text += f"{format_bold('Proceed with reinstallation?')}"
    
    keyboard = create_confirm_keyboard("reinstall", vps_index)
    await send_message(update, text, keyboard)

async def handle_confirm_reinstall(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle confirm reinstall"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    container_name = vps['container_name']
    
    try:
        await execute_lxc(f"lxc delete {container_name} --force")
        
        original_ram = vps["ram"]
        original_cpu = vps["cpu"]
        original_storage = vps["storage"]
        ram_gb = int(original_ram.replace('GB', ''))
        ram_mb = ram_gb * 1024
        storage_gb = int(original_storage.replace('GB', ''))
        
        await execute_lxc(f"lxc init ubuntu:22.04 {container_name} --storage {DEFAULT_STORAGE_POOL}")
        await execute_lxc(f"lxc config set {container_name} limits.memory {ram_mb}MB")
        await execute_lxc(f"lxc config set {container_name} limits.cpu {original_cpu}")
        await execute_lxc(f"lxc config device set {container_name} root size {storage_gb}GB")
        await execute_lxc(f"lxc start {container_name}")
        
        vps["status"] = "running"
        vps["suspended"] = False
        vps["created_at"] = datetime.now().isoformat()
        config_str = f"{ram_gb}GB RAM / {original_cpu} CPU / {storage_gb}GB Disk"
        vps["config"] = config_str
        save_data()
        
        text = f"{format_bold('✅ Reinstallation Complete')}\n\n"
        text += f"Instance {format_code(container_name)} has been successfully redeployed."
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')
        
        # Refresh the control panel
        new_text = await format_vps_info(vps, vps_index)
        keyboard = create_vps_control_keyboard(vps_index, is_owner=not context.user_data.get('is_admin_managing'), is_admin=context.user_data.get('is_admin_managing'))
        await send_message(update, new_text, keyboard)
    except Exception as e:
        text = f"{format_bold('❌ Reinstallation Failed')}\n\n"
        text += f"Error: {format_code(str(e))}"
        await update.callback_query.message.reply_text(text, parse_mode='Markdown')

async def handle_cancel_reinstall(update: Update, context: ContextTypes.DEFAULT_TYPE, vps_index: int):
    """Handle cancel reinstall"""
    target_user_id = context.user_data.get('managing_user')
    if not target_user_id:
        return
    
    vps_list = bot.vps_data.get(target_user_id, [])
    if vps_index >= len(vps_list):
        return
    
    vps = vps_list[vps_index]
    new_text = await format_vps_info(vps, vps_index)
    keyboard = create_vps_control_keyboard(vps_index, is_owner=not context.user_data.get('is_admin_managing'), is_admin=context.user_data.get('is_admin_managing'))
    await send_message(update, new_text, keyboard)

# ============================================================================
# ADMIN COMMANDS
# ============================================================================

async def create_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /create command"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Administrative Privileges Required"),
            parse_mode='Markdown'
        )
        return
    
    # Check arguments
    if len(context.args) < 4:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/create <ram> <cpu> <disk> <user_id>')}\n\n"
            f"Example: {format_code('/create 2 1 20 123456789')}",
            parse_mode='Markdown'
        )
        return
    
    try:
        ram = int(context.args[0])
        cpu = int(context.args[1])
        disk = int(context.args[2])
        target_user_id = context.args[3]
        
        if ram <= 0 or cpu <= 0 or disk <= 0:
            raise ValueError("All values must be positive")
        
        if target_user_id not in bot.vps_data:
            bot.vps_data[target_user_id] = []
        
        vps_count = len(bot.vps_data[target_user_id]) + 1
        container_name = f"zorvix-instance-{target_user_id}-{vps_count}"
        ram_mb = ram * 1024
        
        await update.message.reply_text(
            f"{format_bold('⏳ Instance Provisioning')}\n\n"
            f"Deploying infrastructure...",
            parse_mode='Markdown'
        )
        
        await execute_lxc(f"lxc init ubuntu:22.04 {container_name} --storage {DEFAULT_STORAGE_POOL}")
        await execute_lxc(f"lxc config set {container_name} limits.memory {ram_mb}MB")
        await execute_lxc(f"lxc config set {container_name} limits.cpu {cpu}")
        await execute_lxc(f"lxc config device set {container_name} root size {disk}GB")
        await execute_lxc(f"lxc start {container_name}")
        
        config_str = f"{ram}GB RAM / {cpu} Cores / {disk}GB Storage"
        vps_info = {
            "container_name": container_name,
            "ram": f"{ram}GB",
            "cpu": str(cpu),
            "storage": f"{disk}GB",
            "config": config_str,
            "status": "running",
            "suspended": False,
            "suspension_history": [],
            "created_at": datetime.now().isoformat(),
            "shared_with": []
        }
        bot.vps_data[target_user_id].append(vps_info)
        save_data()
        
        text = f"{format_bold('✅ Instance Provisioned Successfully')}\n\n"
        text += f"{format_section('Owner:', format_code(target_user_id))}\n"
        text += f"{format_section('Instance ID:', format_code(f'#{vps_count}'))}\n"
        text += f"{format_section('Container:', format_code(container_name))}\n\n"
        text += f"{format_bold('Resource Allocation:')}\n"
        text += f"• RAM: {format_code(f'{ram}GB')}\n"
        text += f"• CPU: {format_code(f'{cpu} Cores')}\n"
        text += f"• Storage: {format_code(f'{disk}GB')}"
        
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(
            f"{format_bold('❌ Provisioning Failed')}\n\n"
            f"Error: {format_code(str(e))}",
            parse_mode='Markdown'
        )

async def delete_vps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /delete_vps command"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Administrative Privileges Required"),
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/delete_vps <user_id> <vps_number> [reason]')}\n\n"
            f"Example: {format_code('/delete_vps 123456789 1 \"No longer needed\"')}",
            parse_mode='Markdown'
        )
        return
    
    try:
        target_user_id = context.args[0]
        vps_number = int(context.args[1])
        reason = context.args[2] if len(context.args) > 2 else "Administrative action"
        
        if target_user_id not in bot.vps_data or vps_number < 1 or vps_number > len(bot.vps_data[target_user_id]):
            await update.message.reply_text(
                format_bold("❌ Invalid Instance Reference"),
                parse_mode='Markdown'
            )
            return
        
        vps = bot.vps_data[target_user_id][vps_number - 1]
        container_name = vps["container_name"]
        
        await update.message.reply_text(
            f"{format_bold('⏳ Initiating Decommission')}\n\n"
            f"Removing Instance #{vps_number}...",
            parse_mode='Markdown'
        )
        
        await execute_lxc(f"lxc delete {container_name} --force")
        del bot.vps_data[target_user_id][vps_number - 1]
        
        if not bot.vps_data[target_user_id]:
            del bot.vps_data[target_user_id]
        
        save_data()
        
        text = f"{format_bold('✅ Instance Decommissioned Successfully')}\n\n"
        text += f"{format_section('Owner:', format_code(target_user_id))}\n"
        text += f"{format_section('Instance ID:', format_code(f'#{vps_number}'))}\n"
        text += f"{format_section('Container:', format_code(container_name))}\n"
        text += f"{format_section('Reason:', format_code(reason))}"
        
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(
            f"{format_bold('❌ Decommission Failed')}\n\n"
            f"Error: {format_code(str(e))}",
            parse_mode='Markdown'
        )

async def serverstats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /serverstats command"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Administrative Privileges Required"),
            parse_mode='Markdown'
        )
        return
    
    total_users = len(bot.vps_data)
    total_vps = sum(len(vps_list) for vps_list in bot.vps_data.values())
    
    total_ram = 0
    total_cpu = 0
    total_storage = 0
    running_vps = 0
    suspended_vps = 0
    
    for vps_list in bot.vps_data.values():
        for vps in vps_list:
            ram_gb = int(vps['ram'].replace('GB', ''))
            storage_gb = int(vps['storage'].replace('GB', ''))
            total_ram += ram_gb
            total_cpu += int(vps['cpu'])
            total_storage += storage_gb
            if vps.get('status') == 'running':
                if vps.get('suspended', False):
                    suspended_vps += 1
                else:
                    running_vps += 1
    
    text = f"{format_bold('📊 Infrastructure Statistics')}\n\n"
    text += f"{format_bold('👥 User Distribution')}\n"
    text += f"• Total Users: {format_code(str(total_users))}\n"
    text += f"• Administrators: {format_code(str(len(bot.admin_data.get('admins', [])) + 1))}\n\n"
    
    text += f"{format_bold('🖥️ Instance Distribution')}\n"
    text += f"• Total Instances: {format_code(str(total_vps))}\n"
    text += f"• Operational: {format_code(str(running_vps))}\n"
    text += f"• Isolated: {format_code(str(suspended_vps))}\n\n"
    
    text += f"{format_bold('📈 Resource Allocation')}\n"
    text += f"• Total RAM: {format_code(f'{total_ram}GB')}\n"
    text += f"• Total CPU: {format_code(f'{total_cpu} cores')}\n"
    text += f"• Total Storage: {format_code(f'{total_storage}GB')}"
    
    await update.message.reply_text(text, parse_mode='Markdown')

async def restart_vps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /restart_vps command"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Administrative Privileges Required"),
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 1:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/restart_vps <container_name>')}\n\n"
            f"Example: {format_code('/restart_vps zorvix-instance-123456789-1')}",
            parse_mode='Markdown'
        )
        return
    
    container_name = context.args[0]
    
    try:
        await update.message.reply_text(
            f"{format_bold('⏳ Initiating Restart')}\n\n"
            f"Restarting instance {format_code(container_name)}...",
            parse_mode='Markdown'
        )
        
        await execute_lxc(f"lxc restart {container_name}")
        
        for user_id, vps_list in bot.vps_data.items():
            for vps in vps_list:
                if vps['container_name'] == container_name:
                    vps['status'] = 'running'
                    vps['suspended'] = False
                    save_data()
                    break
        
        text = f"{format_bold('✅ Restart Completed')}\n\n"
        text += f"Instance {format_code(container_name)} has been successfully restarted."
        await update.message.reply_text(text, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(
            f"{format_bold('❌ Restart Failed')}\n\n"
            f"Error: {format_code(str(e))}",
            parse_mode='Markdown'
        )

async def suspend_vps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /suspend_vps command"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Administrative Privileges Required"),
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 1:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/suspend_vps <container_name> [reason]')}\n\n"
            f"Example: {format_code('/suspend_vps zorvix-instance-123456789-1 \"Resource abuse\"')}",
            parse_mode='Markdown'
        )
        return
    
    container_name = context.args[0]
    reason = context.args[1] if len(context.args) > 1 else "Administrative action"
    
    found = False
    for uid, lst in bot.vps_data.items():
        for vps in lst:
            if vps['container_name'] == container_name:
                if vps.get('status') != 'running':
                    await update.message.reply_text(
                        format_bold("❌ Cannot Isolate - Instance must be operational"),
                        parse_mode='Markdown'
                    )
                    return
                
                try:
                    await execute_lxc(f"lxc stop {container_name}")
                    vps['status'] = 'suspended'
                    vps['suspended'] = True
                    if 'suspension_history' not in vps:
                        vps['suspension_history'] = []
                    vps['suspension_history'].append({
                        'time': datetime.now().isoformat(),
                        'reason': reason,
                        'by': f"{update.effective_user.name} ({update.effective_user.id})"
                    })
                    save_data()
                    
                    text = f"{format_bold('✅ Instance Isolated')}\n\n"
                    text += f"{format_code(container_name)} isolated. Reason: {format_code(reason)}"
                    await update.message.reply_text(text, parse_mode='Markdown')
                    found = True
                except Exception as e:
                    await update.message.reply_text(
                        f"{format_bold('❌ Isolation Failed')}\n\n"
                        f"Error: {format_code(str(e))}",
                        parse_mode='Markdown'
                    )
                    return
                break
        if found:
            break
    
    if not found:
        await update.message.reply_text(
            format_bold("❌ Instance Not Found"),
            parse_mode='Markdown'
        )

async def unsuspend_vps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /unsuspend_vps command"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Administrative Privileges Required"),
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 1:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/unsuspend_vps <container_name>')}\n\n"
            f"Example: {format_code('/unsuspend_vps zorvix-instance-123456789-1')}",
            parse_mode='Markdown'
        )
        return
    
    container_name = context.args[0]
    
    found = False
    for uid, lst in bot.vps_data.items():
        for vps in lst:
            if vps['container_name'] == container_name:
                if not vps.get('suspended', False):
                    await update.message.reply_text(
                        format_bold("❌ Not Isolated - Instance is not currently isolated"),
                        parse_mode='Markdown'
                    )
                    return
                
                try:
                    vps['suspended'] = False
                    vps['status'] = 'running'
                    await execute_lxc(f"lxc start {container_name}")
                    save_data()
                    
                    text = f"{format_bold('✅ Isolation Removed')}\n\n"
                    text += f"Instance {format_code(container_name)} reinstated and powered on."
                    await update.message.reply_text(text, parse_mode='Markdown')
                    found = True
                except Exception as e:
                    await update.message.reply_text(
                        f"{format_bold('❌ Reinstatement Failed')}\n\n"
                        f"Error: {format_code(str(e))}",
                        parse_mode='Markdown'
                    )
                break
        if found:
            break
    
    if not found:
        await update.message.reply_text(
            format_bold("❌ Instance Not Found"),
            parse_mode='Markdown'
        )

# ============================================================================
# MAIN ADMIN COMMANDS
# ============================================================================

async def admin_add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /admin_add command"""
    user_id = update.effective_user.id
    if not is_main_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Main Administrator Authorization Required"),
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 1:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/admin_add <user_id>')}\n\n"
            f"Example: {format_code('/admin_add 123456789')}",
            parse_mode='Markdown'
        )
        return
    
    target_user_id = context.args[0]
    
    if target_user_id == str(MAIN_ADMIN_ID):
        await update.message.reply_text(
            format_bold("❌ Invalid Operation - User is already primary administrator"),
            parse_mode='Markdown'
        )
        return
    
    if target_user_id in bot.admin_data.get("admins", []):
        await update.message.reply_text(
            format_bold("❌ Already Administrator - User already has administrative privileges"),
            parse_mode='Markdown'
        )
        return
    
    if "admins" not in bot.admin_data:
        bot.admin_data["admins"] = []
    
    bot.admin_data["admins"].append(target_user_id)
    save_data()
    
    text = f"{format_bold('✅ Administrator Added')}\n\n"
    text += f"User {format_code(target_user_id)} granted administrative privileges."
    await update.message.reply_text(text, parse_mode='Markdown')

async def admin_remove_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /admin_remove command"""
    user_id = update.effective_user.id
    if not is_main_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Main Administrator Authorization Required"),
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 1:
        await update.message.reply_text(
            f"{format_bold('❌ Invalid Arguments')}\n\n"
            f"Usage: {format_code('/admin_remove <user_id>')}\n\n"
            f"Example: {format_code('/admin_remove 123456789')}",
            parse_mode='Markdown'
        )
        return
    
    target_user_id = context.args[0]
    
    if target_user_id == str(MAIN_ADMIN_ID):
        await update.message.reply_text(
            format_bold("❌ Invalid Operation - Cannot modify primary administrator privileges"),
            parse_mode='Markdown'
        )
        return
    
    if target_user_id not in bot.admin_data.get("admins", []):
        await update.message.reply_text(
            format_bold("❌ Not Administrator - User does not have administrative privileges"),
            parse_mode='Markdown'
        )
        return
    
    bot.admin_data["admins"].remove(target_user_id)
    save_data()
    
    text = f"{format_bold('✅ Administrator Removed')}\n\n"
    text += f"User {format_code(target_user_id)} administrative privileges revoked."
    await update.message.reply_text(text, parse_mode='Markdown')

async def admin_list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /admin_list command"""
    user_id = update.effective_user.id
    if not is_main_admin(user_id):
        await update.message.reply_text(
            format_bold("❌ Main Administrator Authorization Required"),
            parse_mode='Markdown'
        )
        return
    
    admins = bot.admin_data.get("admins", [])
    
    text = f"{format_bold('🛡️ Administrative Team')}\n\n"
    text += f"{format_bold('🔰 Primary Administrator:')}\n"
    text += f"• {format_code(str(MAIN_ADMIN_ID))}\n\n"
    
    if admins:
        text += f"{format_bold('🛡️ Administrators:')}\n"
        for admin_id in admins:
            text += f"• {format_code(admin_id)}\n"
    else:
        text += f"{format_bold('🛡️ Administrators:')}\n"
        text += "No additional administrators\n"
    
    await update.message.reply_text(text, parse_mode='Markdown')

# ============================================================================
# ERROR HANDLER
# ============================================================================

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors"""
    logger.error(f"Error: {context.error}", exc_info=context.error)
    
    if update and update.message:
        await update.message.reply_text(
            f"{format_bold('❌ An error occurred')}\n\n"
            f"Please try again or contact support.",
            parse_mode='Markdown'
        )

# ============================================================================
# MAIN EXECUTION
# ============================================================================

async def post_init(application: Application):
    """Post-initialization: set bot commands"""
    commands = [
        BotCommand("start", "Show welcome message"),
        BotCommand("ping", "Check system latency"),
        BotCommand("uptime", "Display host uptime"),
        BotCommand("myvps", "List your instances"),
        BotCommand("manage", "Access control panel"),
        BotCommand("help", "Show command documentation"),
        BotCommand("create", "Provision new instance (Admin)"),
        BotCommand("delete_vps", "Decommission instance (Admin)"),
        BotCommand("serverstats", "Show infrastructure stats (Admin)"),
        BotCommand("restart_vps", "Restart instance (Admin)"),
        BotCommand("suspend_vps", "Isolate instance (Admin)"),
        BotCommand("unsuspend_vps", "Remove isolation (Admin)"),
        BotCommand("admin_add", "Add administrator (Main Admin)"),
        BotCommand("admin_remove", "Remove administrator (Main Admin)"),
        BotCommand("admin_list", "List administrators (Main Admin)"),
    ]
    
    await application.bot.set_my_commands(commands, scope=BotCommandScopeAllPrivateChats())

def main():
    """Main function"""
    if not TELEGRAM_TOKEN or TELEGRAM_TOKEN == "YOUR_TELEGRAM_BOT_TOKEN_HERE":
        logger.error("No Telegram token configured.")
        print("ERROR: No Telegram token configured.")
        print("Please set the TELEGRAM_TOKEN variable at the top of this file.")
        print("\nTo get a Telegram bot token:")
        print("1. Open Telegram and search for @BotFather")
        print("2. Send /newbot and follow the instructions")
        print("3. Copy the token and update the TELEGRAM_TOKEN variable")
        return
    
    # Load data
    bot.vps_data = load_vps_data()
    bot.admin_data = load_admin_data()
    
    # Create application
    application = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()
    
    # Register command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("ping", ping_command))
    application.add_handler(CommandHandler("uptime", uptime_command))
    application.add_handler(CommandHandler("myvps", myvps_command))
    application.add_handler(CommandHandler("manage", manage_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("create", create_command))
    application.add_handler(CommandHandler("delete_vps", delete_vps_command))
    application.add_handler(CommandHandler("serverstats", serverstats_command))
    application.add_handler(CommandHandler("restart_vps", restart_vps_command))
    application.add_handler(CommandHandler("suspend_vps", suspend_vps_command))
    application.add_handler(CommandHandler("unsuspend_vps", unsuspend_vps_command))
    application.add_handler(CommandHandler("admin_add", admin_add_command))
    application.add_handler(CommandHandler("admin_remove", admin_remove_command))
    application.add_handler(CommandHandler("admin_list", admin_list_command))
    
    # Register callback handler
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    # Register error handler
    application.add_error_handler(error_handler)
    
    # Start CPU monitoring thread
    cpu_thread = threading.Thread(target=cpu_monitor, daemon=True)
    cpu_thread.start()
    
    # Start VPS monitoring task
    application.job_queue.run_once(lambda ctx: ctx.application.create_task(vps_monitor()), 1)
    
    # Start bot
    logger.info("ZorvixHost Telegram Bot starting...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
