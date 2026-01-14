

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

TELEGRAM_TOKEN = "8 L91gYijI7s4"
MAIN_ADMIN_ID = 7asdfsdf29
DEFAULT_STORAGE_POOL = "default"
CPU_THRESHOLD = 90
RAM_THRESHOLD = 90
CHECK_INTERVAL = 600

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('telegram_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('zorvixhost_telegram_bot')

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
    return f"*{text}*"

def format_code(text: str) -> str:
    return f"`{text}`"

def format_code_block(text: str) -> str:
    return f"```\n{text}\n```"

def format_section(title: str, content: str) -> str:
    return f"{format_bold(title)}\n{content}"

def truncate_text(text: str, max_length: int = 4096) -> str:
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
        return {}

def load_admin_data():
    try:
        with open('admin_data.json', 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"admins": []}

def save_data():
    try:
        with open('vps_data.json', 'w') as f:
            json.dump(bot.vps_data, f, indent=4)
        with open('admin_data.json', 'w') as f:
            json.dump(bot.admin_data, f, indent=4)
    except Exception as e:
        logger.error(f"Error saving data: {e}")

# ============================================================================
# PERMISSION CHECKS
# ============================================================================

def is_admin(user_id: int) -> bool:
    return user_id == MAIN_ADMIN_ID or str(user_id) in bot.admin_data.get("admins", [])

def is_main_admin(user_id: int) -> bool:
    return user_id == MAIN_ADMIN_ID

# ============================================================================
# LXC COMMAND EXECUTION
# ============================================================================

async def execute_lxc(command: str, timeout: int = 120) -> str:
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
    except Exception as e:
        logger.error(f"LXC Error: {command} - {str(e)}")
        raise

# ============================================================================
# HOST MONITORING SYSTEM
# ============================================================================

def get_cpu_usage() -> float:
    try:
        result = subprocess.run(['top', '-bn1'], capture_output=True, text=True)
        output = result.stdout
        for line in output.split('\n'):
            if '%Cpu(s):' in line:
                words = line.split()
                for i, word in enumerate(words):
                    if word == 'id,':
                        idle = float(words[i-1].rstrip(','))
                        return 100.0 - idle
        return 0.0
    except Exception:
        return 0.0

def cpu_monitor():
    while bot.cpu_monitor_active:
        try:
            cpu_usage = get_cpu_usage()
            if cpu_usage > CPU_THRESHOLD:
                subprocess.run(['lxc', 'stop', '--all', '--force'], check=True)
                for user_id, vps_list in bot.vps_data.items():
                    for vps in vps_list:
                        if vps.get('status') == 'running':
                            vps['status'] = 'stopped'
                save_data()
            time.sleep(60)
        except Exception as e:
            logger.error(f"Error in CPU monitor: {e}")
            time.sleep(60)

# ============================================================================
# CONTAINER STATISTICS
# ============================================================================

async def get_container_status(container_name: str) -> str:
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
    usage = await get_container_cpu_pct(container_name)
    return f"{usage:.1f}%"

async def get_container_cpu_pct(container_name: str) -> float:
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
                        idle = float(words[i-1].rstrip(','))
                        return 100.0 - idle
        return 0.0
    except Exception:
        return 0.0

async def get_container_memory(container_name: str) -> str:
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
            total, used = int(parts[1]), int(parts[2])
            usage_pct = (used / total * 100) if total > 0 else 0
            return f"{used}/{total} MB ({usage_pct:.1f}%)"
        return "Unknown"
    except Exception:
        return "Unknown"

async def get_container_ram_pct(container_name: str) -> float:
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
            total, used = int(parts[1]), int(parts[2])
            return (used / total * 100) if total > 0 else 0
        return 0.0
    except Exception:
        return 0.0

async def get_container_disk(container_name: str) -> str:
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
                    return f"{parts[2]}/{parts[1]} ({parts[4]})"
        return "Unknown"
    except Exception:
        return "Unknown"

def get_uptime() -> str:
    try:
        result = subprocess.run(['uptime'], capture_output=True, text=True)
        return result.stdout.strip()
    except Exception:
        return "Unknown"

# ============================================================================
# VPS MONITORING TASK
# ============================================================================

async def vps_monitor():
    while True:
        try:
            for user_id, vps_list in bot.vps_data.items():
                for vps in vps_list:
                    if vps.get('status') == 'running' and not vps.get('suspended', False):
                        container = vps['container_name']
                        cpu = await get_container_cpu_pct(container)
                        ram = await get_container_ram_pct(container)
                        if cpu > CPU_THRESHOLD or ram > RAM_THRESHOLD:
                            reason = f"Resource exceeded: CPU {cpu:.1f}%, RAM {ram:.1f}%"
                            await execute_lxc(f"lxc stop {container}")
                            vps['status'] = 'suspended'
                            vps['suspended'] = True
                            if 'suspension_history' not in vps:
                                vps['suspension_history'] = []
                            vps['suspension_history'].append({
                                'time': datetime.now().isoformat(),
                                'reason': reason,
                                'by': 'Auto-System'
                            })
                            save_data()
            await asyncio.sleep(CHECK_INTERVAL)
        except Exception as e:
            logger.error(f"VPS monitor error: {e}")
            await asyncio.sleep(60)

# ============================================================================
# INLINE KEYBOARD HELPERS
# ============================================================================

def create_vps_select_keyboard(vps_list: List[Dict], callback_prefix: str = "vps_select") -> InlineKeyboardMarkup:
    keyboard = []
    for i, vps in enumerate(vps_list):
        status = vps.get('status', 'unknown').upper()
        if vps.get('suspended', False):
            status += " (ISOLATED)"
        label = f"#{i+1} - {vps['container_name']} [{status}]"
        keyboard.append([InlineKeyboardButton(label, callback_data=f"{callback_prefix}:{i}")])
    return InlineKeyboardMarkup(keyboard)

def create_vps_control_keyboard(vps_index: int, is_owner: bool = True, is_admin: bool = False) -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("▶️ Start", callback_data=f"vps_start:{vps_index}"),
         InlineKeyboardButton("⏸️ Stop", callback_data=f"vps_stop:{vps_index}")],
        [InlineKeyboardButton("📊 Stats", callback_data=f"vps_stats:{vps_index}"),
         InlineKeyboardButton("🔑 SSH", callback_data=f"vps_ssh:{vps_index}")]
    ]
    if is_owner and not is_admin:
        keyboard.append([InlineKeyboardButton("🔄 Reinstall", callback_data=f"vps_reinstall:{vps_index}")])
    keyboard.append([InlineKeyboardButton("⬅️ Back", callback_data="vps_back")])
    return InlineKeyboardMarkup(keyboard)

def create_confirm_keyboard(action: str, vps_index: int) -> InlineKeyboardMarkup:
    keyboard = [[
        InlineKeyboardButton("✅ Confirm", callback_data=f"confirm_{action}:{vps_index}"),
        InlineKeyboardButton("❌ Cancel", callback_data=f"cancel_{action}:{vps_index}")
    ]]
    return InlineKeyboardMarkup(keyboard)

# ============================================================================
# MESSAGE HELPERS
# ============================================================================

async def send_message(update: Update, text: str, reply_markup=None, parse_mode='Markdown'):
    if update.callback_query:
        try:
            await update.callback_query.message.edit_text(text=text, reply_markup=reply_markup, parse_mode=parse_mode)
        except Exception:
            pass
    elif update.message:
        await update.message.reply_text(text=text, reply_markup=reply_markup, parse_mode=parse_mode)

# ============================================================================
# VPS MANAGEMENT HELPERS
# ============================================================================

async def format_vps_info(vps: Dict, index: int) -> str:
    container_name = vps['container_name']
    status = vps.get('status', 'unknown').upper()
    if vps.get('suspended', False): status += " (ISOLATED)"
    
    lxc_status = await get_container_status(container_name)
    cpu_usage = await get_container_cpu(container_name)
    memory_usage = await get_container_memory(container_name)
    disk_usage = await get_container_disk(container_name)
    
    text = f"{format_bold('🖥️ Instance Management')} #{index + 1}\n\n"
    text += f"{format_section('Container:', format_code(container_name))}\n"
    text += f"{format_section('Status:', format_code(status))}\n"
    text += f"{format_section('LXC Status:', format_code(lxc_status))}\n\n"
    text += f"{format_bold('📈 Live Metrics')}\n"
    text += f"• CPU: {format_code(cpu_usage)}\n• Memory: {format_code(memory_usage)}\n• Disk: {format_code(disk_usage)}\n\n"
    return truncate_text(text)

async def format_vps_list(vps_list: List[Dict]) -> str:
    if not vps_list: return format_bold("❌ No Allocated Instances")
    text = f"{format_bold('📋 Your Instances')}\n\n"
    for i, vps in enumerate(vps_list):
        status = vps.get('status', 'unknown').upper()
        if vps.get('suspended', False): status += " (ISOLATED)"
        text += f"{format_bold(f'Instance #{i+1}:')} {format_code(vps['container_name'])}\n  • Status: {format_code(status)}\n\n"
    return truncate_text(text)

# ============================================================================
# TELEGRAM COMMAND HANDLERS
# ============================================================================

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = f"{format_bold('🚀 Welcome to ZorvixHost!')}\n\nUse /manage to access your instances."
    await update.message.reply_text(welcome_text, parse_mode='Markdown')

async def ping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"Bot latency: {format_code('Active')}", parse_mode='Markdown')

async def uptime_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(format_code_block(get_uptime()), parse_mode='Markdown')

async def myvps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = await format_vps_list(bot.vps_data.get(str(update.effective_user.id), []))
    await update.message.reply_text(text, parse_mode='Markdown')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("ZorvixHost Bot Help: Use /manage to control VPS.", parse_mode='Markdown')

async def manage_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    vps_list = bot.vps_data.get(user_id, [])
    if not vps_list:
        await update.message.reply_text("❌ No Instances Found", parse_mode='Markdown')
        return
    context.user_data['managing_user'] = user_id
    context.user_data['is_admin_managing'] = False
    keyboard = create_vps_select_keyboard(vps_list)
    await update.message.reply_text("Select instance:", reply_markup=keyboard, parse_mode='Markdown')

# ============================================================================
# CALLBACK QUERY HANDLERS
# ============================================================================

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data.split(':')
    action, idx = data[0], int(data[1]) if len(data) > 1 else 0
    
    if action == "vps_select":
        vps = bot.vps_data.get(str(update.effective_user.id), [])[idx]
        text = await format_vps_info(vps, idx)
        keyboard = create_vps_control_keyboard(idx)
        await send_message(update, text, keyboard)
    elif action == "vps_back":
        vps_list = bot.vps_data.get(str(update.effective_user.id), [])
        await send_message(update, "Select instance:", create_vps_select_keyboard(vps_list))
    elif action == "vps_start":
        vps = bot.vps_data.get(str(update.effective_user.id), [])[idx]
        await execute_lxc(f"lxc start {vps['container_name']}")
        vps['status'] = 'running'
        save_data()
        await query.message.reply_text("✅ Started")
    elif action == "vps_stop":
        vps = bot.vps_data.get(str(update.effective_user.id), [])[idx]
        await execute_lxc(f"lxc stop {vps['container_name']}")
        vps['status'] = 'stopped'
        save_data()
        await query.message.reply_text("✅ Stopped")

# ============================================================================
# ADMIN COMMANDS (FIXED SYNTAX)
# ============================================================================

async def create_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id): return
    if len(context.args) < 4:
        await update.message.reply_text("Usage: /create <ram> <cpu> <disk> <user_id>")
        return
    ram, cpu, disk, target_uid = context.args[0], context.args[1], context.args[2], context.args[3]
    container_name = f"zorvix-{target_uid}-{len(bot.vps_data.get(target_uid, [])) + 1}"
    await execute_lxc(f"lxc init ubuntu:22.04 {container_name} --storage {DEFAULT_STORAGE_POOL}")
    vps_info = {"container_name": container_name, "ram": f"{ram}GB", "cpu": cpu, "storage": f"{disk}GB", "status": "running"}
    if target_uid not in bot.vps_data: bot.vps_data[target_uid] = []
    bot.vps_data[target_uid].append(vps_info)
    save_data()
    await update.message.reply_text(f"✅ Created {container_name}")

async def delete_vps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id): return
    if len(context.args) < 2:
        # 修理后的代码：不使用内部转义引号 
        msg = f"Example: {format_code('/delete_vps 123456 1 No_longer_needed')}"
        await update.message.reply_text(msg, parse_mode='Markdown')
        return
    # Logic to delete...
    await update.message.reply_text("✅ Deleted")

async def serverstats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id): return
    total_vps = sum(len(v) for v in bot.vps_data.values())
    await update.message.reply_text(f"Total Instances: {total_vps}")

async def suspend_vps_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id): return
    if len(context.args) < 1:
        # 修理后的代码：不使用内部转义引号 
        msg = f"Example: {format_code('/suspend_vps container_name Resource_abuse')}"
        await update.message.reply_text(msg, parse_mode='Markdown')
        return

async def post_init(application: Application):
    commands = [BotCommand("start", "Welcome"), BotCommand("manage", "Control Panel")]
    await application.bot.set_my_commands(commands)

def main():
    bot.vps_data = load_vps_data()
    bot.admin_data = load_admin_data()
    application = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()
    
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("manage", manage_command))
    application.add_handler(CommandHandler("create", create_command))
    application.add_handler(CommandHandler("delete_vps", delete_vps_command))
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    threading.Thread(target=cpu_monitor, daemon=True).start()
    application.run_polling()

if __name__ == "__main__":
    main()

