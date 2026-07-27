import { InvoiceStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../database/prisma';
import { env } from '../config/env';
import { AuthUser } from '../types';
import { logger } from '../utils/logger';

// Natural language querying over the invoice data. User intent is mapped to one
// of a fixed set of safe, parameterized Prisma queries. The model never
// produces raw SQL or query bodies, so there is no injection surface.

type Intent =
  | 'due_this_week'
  | 'highest_risk'
  | 'overdue'
  | 'summary'
  | 'help';

export interface ChatResult {
  intent: Intent;
  answer: string;
  data: unknown;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const CLOSED: InvoiceStatus[] = [InvoiceStatus.SETTLED, InvoiceStatus.CLOSED];

export class AiChatService {
  async query(actor: AuthUser, text: string): Promise<ChatResult> {
    const intent = await this.classify(text);
    const scope = this.scopeFor(actor);

    switch (intent) {
      case 'due_this_week':
        return this.dueThisWeek(scope);
      case 'highest_risk':
        return this.highestRisk(scope);
      case 'overdue':
        return this.overdue(scope);
      case 'summary':
        return this.summary(scope);
      default:
        return {
          intent: 'help',
          answer:
            'I can answer questions about invoices due this week, the highest risk invoices, overdue invoices, and portfolio summaries.',
          data: null,
        };
    }
  }

  // Restricts every query to what the caller is allowed to see.
  private scopeFor(actor: AuthUser): Prisma.InvoiceWhereInput {
    if (actor.role === Role.ADMIN) return {};
    if (actor.role === Role.INVESTOR) {
      return { investments: { some: { investorId: actor.id } } };
    }
    return { sellerId: actor.id };
  }

  private async dueThisWeek(scope: Prisma.InvoiceWhereInput): Promise<ChatResult> {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
    const invoices = await prisma.invoice.findMany({
      where: {
        ...scope,
        dueDate: { gte: now, lte: weekAhead },
        status: { notIn: CLOSED },
      },
      orderBy: { dueDate: 'asc' },
    });
    return {
      intent: 'due_this_week',
      answer: await this.phrase(
        `There ${invoices.length === 1 ? 'is' : 'are'} ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} due within the next seven days.`,
        invoices,
      ),
      data: invoices,
    };
  }

  private async highestRisk(scope: Prisma.InvoiceWhereInput): Promise<ChatResult> {
    const invoices = await prisma.invoice.findMany({
      where: { ...scope, riskScore: { not: null } },
      orderBy: { riskScore: 'desc' },
      take: 10,
    });
    const top = invoices[0];
    return {
      intent: 'highest_risk',
      answer: await this.phrase(
        top
          ? `The highest risk invoice is ${top.invoiceNumber} with a risk score of ${top.riskScore}. Showing the top ${invoices.length}.`
          : 'No scored invoices were found.',
        invoices,
      ),
      data: invoices,
    };
  }

  private async overdue(scope: Prisma.InvoiceWhereInput): Promise<ChatResult> {
    const invoices = await prisma.invoice.findMany({
      where: {
        ...scope,
        dueDate: { lt: new Date() },
        status: { notIn: CLOSED },
      },
      include: { seller: { select: { id: true, name: true, email: true } } },
      orderBy: { dueDate: 'asc' },
    });
    return {
      intent: 'overdue',
      answer: await this.phrase(
        `There ${invoices.length === 1 ? 'is' : 'are'} ${invoices.length} overdue invoice${invoices.length === 1 ? '' : 's'}.`,
        invoices,
      ),
      data: invoices,
    };
  }

  private async summary(scope: Prisma.InvoiceWhereInput): Promise<ChatResult> {
    const [count, agg] = await Promise.all([
      prisma.invoice.count({ where: scope }),
      prisma.invoice.aggregate({ where: scope, _sum: { amount: true } }),
    ]);
    const total = Number(agg._sum.amount ?? 0);
    return {
      intent: 'summary',
      answer: await this.phrase(
        `There are ${count} invoices with a combined face value of ${total.toLocaleString()}.`,
        { count, totalFaceValue: total },
      ),
      data: { count, totalFaceValue: total },
    };
  }

  // Keyword classifier with an optional OpenAI upgrade.
  private async classify(text: string): Promise<Intent> {
    const heuristic = this.classifyHeuristic(text);
    if (!env.openaiEnabled) return heuristic;
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Classify the user question into exactly one intent from this list and reply with only that token: due_this_week, highest_risk, overdue, summary, help.',
          },
          { role: 'user', content: text },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim() as Intent | undefined;
      const allowed: Intent[] = ['due_this_week', 'highest_risk', 'overdue', 'summary', 'help'];
      return raw && allowed.includes(raw) ? raw : heuristic;
    } catch (err) {
      logger.warn({ err }, 'OpenAI intent classification failed, using heuristic');
      return heuristic;
    }
  }

  private classifyHeuristic(text: string): Intent {
    const t = text.toLowerCase();
    if (t.includes('overdue') || t.includes('late')) return 'overdue';
    if (t.includes('risk')) return 'highest_risk';
    if (t.includes('due') && (t.includes('week') || t.includes('soon'))) return 'due_this_week';
    if (t.includes('due')) return 'due_this_week';
    if (t.includes('how many') || t.includes('total') || t.includes('summary') || t.includes('count')) {
      return 'summary';
    }
    return 'help';
  }

  // Optionally rephrases a deterministic answer with OpenAI. Falls back to the
  // deterministic sentence when OpenAI is unavailable.
  private async phrase(deterministic: string, data: unknown): Promise<string> {
    if (!env.openaiEnabled) return deterministic;
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You summarize invoice query results for a fintech operator in one or two concise sentences. Use only the provided facts.',
          },
          {
            role: 'user',
            content: JSON.stringify({ baseline: deterministic, sample: Array.isArray(data) ? data.slice(0, 5) : data }),
          },
        ],
      });
      return completion.choices[0]?.message?.content?.trim() || deterministic;
    } catch {
      return deterministic;
    }
  }
}

export const aiChatService = new AiChatService();
