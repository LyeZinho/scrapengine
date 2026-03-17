import { Telegraf } from 'telegraf';
import type { JobData } from './deduplication.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

export async function notifyTelegram(jobs: JobData[]): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID || jobs.length === 0) {
    console.log('Telegram notification skipped: no bot token or chat ID configured');
    return;
  }

  const message = formatJobsMessage(jobs);
  
  try {
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_CHAT_ID,
      message,
      { parse_mode: 'Markdown' }
    );
    console.log(`Telegram notification sent: ${jobs.length} jobs`);
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}

function formatJobsMessage(jobs: JobData[]): string {
  const header = `🆕 *Novas Vagas Encontradas* (${jobs.length})\n\n`;
  
  const jobList = jobs.slice(0, 5).map((job, index) => {
    const remote = job.remote ? ' 🏠 *REMOTE*' : '';
    return `${index + 1}. *${escapeMarkdown(job.title)}*\n   🏢 ${escapeMarkdown(job.company || 'N/A')}\n   📍 ${escapeMarkdown(job.location || 'N/A')}${remote}\n   🔗 [Ver vaga](${job.url})\n`;
  }).join('\n');
  
  const footer = jobs.length > 5 ? `\n...e mais ${jobs.length - 5} vagas` : '';
  
  return header + jobList + footer;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
