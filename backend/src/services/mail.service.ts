import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class MailService {
  private client: Resend | null | undefined;

  private getClient(): Resend | null {
    if (this.client !== undefined) return this.client;
    if (!env.RESEND_API_KEY) {
      this.client = null;
      return null;
    }
    this.client = new Resend(env.RESEND_API_KEY);
    return this.client;
  }

  async send(payload: MailPayload): Promise<void> {
    const from = env.MAIL_FROM || 'Zynext TalentHub <onboarding@resend.dev>';
    const client = this.getClient();

    if (!client) {
      logger.info(
        { to: payload.to, subject: payload.subject, preview: payload.text.slice(0, 500) },
        'mail_dev_console',
      );
      // eslint-disable-next-line no-console
      console.info(`[mail:dev] to=${payload.to} subject=${payload.subject}\n${payload.text}`);
      return;
    }

    try {
      const { data, error } = await client.emails.send({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<pre>${payload.text}</pre>`,
      });
      if (error) {
        logger.error(
          { err: error, to: payload.to, subject: payload.subject },
          'mail_send_failed',
        );
        // eslint-disable-next-line no-console
        console.error('[mail] send failed', error);
        return;
      }
      logger.info(
        { to: payload.to, subject: payload.subject, messageId: data?.id },
        'mail_sent',
      );
    } catch (err) {
      // Do not fail the business transaction (invite/reset already committed).
      logger.error(
        { err, to: payload.to, subject: payload.subject },
        'mail_send_failed',
      );
      // eslint-disable-next-line no-console
      console.error('[mail] send failed', err);
    }
  }

  sendInvite(
    to: string,
    orgName: string,
    acceptUrl: string,
    extras?: { orgSlug?: string; email?: string },
  ): Promise<void> {
    const slug = extras?.orgSlug?.trim();
    const email = extras?.email?.trim() || to;
    const signInHint = slug
      ? `\n\nAfter you set your password you will be signed in. Later you can sign in with:\n- Organization slug: ${slug}\n- Email: ${email}`
      : '';
    const signInHtml = slug
      ? `<p>After you set your password you will be signed in. Later you can sign in with organization slug <strong>${slug}</strong> and email <strong>${email}</strong>.</p>`
      : '';
    return this.send({
      to,
      subject: `You're invited to ${orgName} on Zynext TalentHub`,
      text: `You have been invited to join ${orgName}. Accept your invite: ${acceptUrl}${signInHint}`,
      html: `<p>You have been invited to join <strong>${orgName}</strong>.</p><p><a href="${acceptUrl}">Accept invite</a></p>${signInHtml}`,
    });
  }

  sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    return this.send({
      to,
      subject: 'Reset your Zynext TalentHub password',
      text: `Reset your password: ${resetUrl}`,
      html: `<p><a href="${resetUrl}">Reset your password</a></p>`,
    });
  }

  sendCertificateIssued(to: string, courseTitle: string, number: string): Promise<void> {
    return this.send({
      to,
      subject: `Certificate issued: ${courseTitle}`,
      text: `Your certificate ${number} for ${courseTitle} is ready.`,
    });
  }

  sendDueReminder(input: {
    to: string;
    courseTitle: string;
    dueLabel: string;
    daysLeft: number;
  }): Promise<void> {
    const subject =
      input.daysLeft < 0
        ? `Overdue: ${input.courseTitle}`
        : input.daysLeft === 0
          ? `Due today: ${input.courseTitle}`
          : `Reminder: ${input.courseTitle} due in ${input.daysLeft} day(s)`;
    const text =
      input.daysLeft < 0
        ? `Your assignment for ${input.courseTitle} was due on ${input.dueLabel}. Please complete it as soon as possible.`
        : `Your assignment for ${input.courseTitle} is due on ${input.dueLabel}.`;
    return this.send({ to: input.to, subject, text });
  }

  sendScheduledReport(input: {
    recipients: string[];
    orgName: string;
    reportType: string;
    downloadUrl: string;
    format: string;
  }): Promise<void> {
    const subject = `${input.orgName} — ${input.reportType} report (${input.format})`;
    const text = `Your scheduled ${input.reportType} report is ready.\n\nDownload: ${input.downloadUrl}`;
    return Promise.all(
      input.recipients.map((to) => this.send({ to, subject, text })),
    ).then(() => undefined);
  }

  sendCertExpiry(input: {
    to: string;
    courseTitle: string;
    expiryLabel: string;
    daysLeft: number;
  }): Promise<void> {
    const subject =
      input.daysLeft < 0
        ? `Certificate expired: ${input.courseTitle}`
        : `Certificate expiring: ${input.courseTitle}`;
    const text =
      input.daysLeft < 0
        ? `Your certificate for ${input.courseTitle} expired on ${input.expiryLabel}.`
        : `Your certificate for ${input.courseTitle} expires on ${input.expiryLabel} (${input.daysLeft} day(s) remaining).`;
    return this.send({ to: input.to, subject, text });
  }
}

export const mailService = new MailService();
