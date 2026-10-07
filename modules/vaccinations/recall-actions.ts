"use server";

import { action, type FormState } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { toMessageLocale } from "@/lib/whatsapp/messages";
import { composeRecallBatch } from "@/lib/whatsapp/recall-message";
import { listRecalls, parseRecallFilters, RECALL_COPY_CAP } from "./recall";
import {
  deleteRecallContact,
  recordRecallContact,
  type RecallOutcome,
} from "./recall-service";

/** Returns the new mark's id so the toast can take it back. */
export const recordRecallContactAction = action(
  "vaccination.recallContact",
  async (
    ctx,
    vaccinationId: string,
    outcome: RecallOutcome,
  ): Promise<FormState & { contactId?: string }> => {
    const { id } = await recordRecallContact(vaccinationId, outcome, ctx);
    return { success: true, contactId: id };
  },
);

export const deleteRecallContactAction = action(
  "vaccination.recallContact.delete",
  async (ctx, id: string): Promise<FormState> => {
    await deleteRecallContact(id, ctx);
    return { success: true };
  },
);

/**
 * Every message the filtered list would send, one per owner, as one text
 * to paste into WhatsApp. Built when asked rather than with the page: the
 * list shows a hundred rows and the copy covers the whole filter.
 *
 * Capped, and the cap is said back: past 500 rows a clipboard is the wrong
 * tool, and the screen says how many owners the text holds.
 */
export const recallMessagesAction = action(
  "vaccination.recallMessages",
  async (
    ctx,
    filters: {
      view: string;
      age?: string;
      vaccine?: string;
      species?: string;
      contact?: string;
      sort?: string;
    },
  ): Promise<FormState & { text?: string; owners?: number; rows?: number }> => {
    requirePermission(ctx.userRole, "reminders.write");
    const parsed = parseRecallFilters(filters);
    const [clinic, { items, total }] = await Promise.all([
      prisma.clinic.findUnique({
        where: { id: ctx.clinicId },
        select: { name: true, phone: true, timezone: true },
      }),
      listRecalls({ ...parsed, clinicId: ctx.clinicId, perPage: RECALL_COPY_CAP }),
    ]);
    const { text, owners } = composeRecallBatch(
      // An owner with no number cannot be messaged; they stay on the list
      // for a call or a letter, and out of a WhatsApp batch.
      items
        .filter((r) => r.ownerPhone)
        .map((r) => ({
          ownerId: r.ownerId,
          ownerName: [r.ownerFirstName, r.ownerLastName].filter(Boolean).join(" "),
          ownerPhone: r.ownerPhone ? formatPhone(r.ownerPhone) : null,
          ownerLocale: toMessageLocale(r.ownerLanguage),
          petName: r.petName,
          vaccine: r.name,
          dueAt: r.nextDueAt,
        })),
      {
        name: clinic?.name ?? "",
        phone: clinic?.phone ? formatPhone(clinic.phone) : null,
        timezone: clinic?.timezone ?? "Europe/Istanbul",
      },
    );
    return { success: true, text, owners, rows: Math.min(total, RECALL_COPY_CAP) };
  },
);
