"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Client, Pet } from "@/generated/prisma/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Callout } from "@/components/ui/callout";
import { SubmitButton } from "@/components/submit-button";
import { REMINDER_TYPES } from "@/modules/reminders/schema";
import { createReminderAction } from "@/modules/reminders/actions";
import { searchClientsAction } from "@/modules/clients/actions";
import { searchPetsAction } from "@/modules/pets/actions";
import { ActionForm, useActionForm } from "@/components/forms/action-form";

/**
 * Whether a message can reach this client at all.
 *
 * `null` for a client we know nothing about: one reached through the
 * animal picker, whose owner arrives with a name and nothing else. The
 * form then says nothing rather than guessing, because a warning that is
 * wrong is worse than one that is missing (TEAM.md #21).
 */
type Contactable = Pick<Client, "phone" | "notificationsOptIn">;

interface Props {
  clients: Pick<
    Client,
    "id" | "firstName" | "lastName" | "phone" | "notificationsOptIn"
  >[];
  /** See `InvoiceForm`: true when the list was cut off at its cap. */
  clientsCapped?: boolean;
  /**
   * The owner's name travels with the animal rather than being looked up
   * in `clients`: the two lists are capped separately, so a listed
   * animal's owner is not necessarily among the listed clients, and
   * filling the client in with an id nobody can name is the blank
   * required field all over again.
   */
  pets?: (Pick<Pet, "id" | "name" | "ownerId"> & { ownerName: string })[];
  petsCapped?: boolean;
  defaultClientId?: string;
  defaultPetId?: string;
}

export function ReminderForm({
  clients,
  clientsCapped,
  pets,
  petsCapped,
  defaultClientId,
  defaultPetId,
}: Props) {
  const t = useTranslations("reminder");
  const tType = useTranslations("enum.reminderType");
  const tClient = useTranslations("client");
  const tPet = useTranslations("pet");
  const tCommon = useTranslations("common");
  const form = useActionForm(createReminderAction, {});
  const { state, reset } = form;

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName}`,
      })),
    [clients],
  );

  const handedContact = useMemo(
    () => new Map(clients.map((c) => [c.id, c as Contactable])),
    [clients],
  );

  // The pair, not the id: both pickers are handed a capped fifty, and
  // each can be given a record that is not on its own list — the owner
  // filled in from an animal, or a default arriving in the URL.
  const initialClient = () =>
    clientOptions.find((o) => o.value === defaultClientId) ?? null;
  const initialPet = () => {
    const p = pets?.find((x) => x.id === defaultPetId);
    return p ? { value: p.id, label: p.name } : null;
  };

  const [client, setClient] = useState<ComboOption | null>(initialClient);
  // Consent and number for the client currently chosen.
  //
  // Held as state and set in the handlers, not read from a ref during
  // render, for the reason `petOwner` below carries: a ref read while
  // rendering is a value React has not agreed to re-run for.
  const [contact, setContact] = useState<Contactable | null>(
    () => handedContact.get(defaultClientId ?? "") ?? null,
  );
  // Learned from the search, which carries consent and number with every
  // hit precisely so this path is not the blind one.
  const searchedContact = useRef(new Map<string, Contactable>());
  const searchClients = useCallback(async (term: string) => {
    const found = await searchClientsAction(term);
    for (const o of found.options)
      searchedContact.current.set(o.value, {
        phone: o.phone,
        notificationsOptIn: o.notificationsOptIn,
      });
    return {
      options: found.options.map(({ value, label }) => ({ value, label })),
      hasMore: found.hasMore,
    };
  }, []);
  const contactFor = (id: string) =>
    handedContact.get(id) ?? searchedContact.current.get(id) ?? null;
  const [pet, setPet] = useState<ComboOption | null>(initialPet);
  const clientId = client?.value ?? "";

  // Who owns the animals the search has returned. The picker deals in
  // `{ value, label }`, and the owner is neither; kept in a ref rather
  // than state because nothing on screen depends on it — it is read
  // once, in the handler, when one of those animals is chosen.
  const searchedOwners = useRef(new Map<string, ComboOption>());
  // The owner of the animal currently held, when the handed list cannot
  // name it. State rather than a read of the map above, because the
  // check below runs during render and a ref read there is a value React
  // has not agreed to re-run for.
  const [petOwner, setPetOwner] = useState<ComboOption | null>(null);
  // Narrowed by the chosen client, when there is one.
  //
  // This picker was the one left without a search, and the reason was
  // real: a clinic-wide search behind a list that has already been cut
  // down to one client's animals would answer with animals that are not
  // theirs, and choosing one gets refused by the server after it is
  // typed. `searchPetsAction` takes the owner now and narrows inside
  // the query, so the two halves agree and the clinic's 51st animal is
  // reachable from its owner's page.
  //
  // `clientId` is in the dependency list because it has to be: a
  // callback closed over an empty client keeps searching the whole
  // clinic after one is chosen, which is the same wrong answer arriving
  // one step later. With no client chosen, `undefined` falls through to
  // the clinic-wide search, which is right — that is the case where the
  // animal is the question and the owner is the answer.
  const searchPets = useCallback(
    async (term: string) => {
      const found = await searchPetsAction(term, clientId || undefined);
      for (const p of found.options) {
        searchedOwners.current.set(p.value, {
          value: p.ownerId,
          label: p.ownerLabel,
        });
      }
      return {
        options: found.options.map(({ value, label }) => ({ value, label })),
        // Passed through rather than recomputed: whether the search was
        // truncated is the server's answer about its own query, and the
        // owner map above does not change it.
        hasMore: found.hasMore,
      };
    },
    [clientId],
  );

  // With a client chosen, only their animals — the reminder is refused
  // otherwise (`createReminder` checks `ownerId`), so offering the rest is
  // offering work that will be thrown away after it is typed.
  //
  // With none chosen, all of them, because a vet thinks in animals: "remind
  // them about Karabaş" comes before remembering whose Karabaş it is.
  // Choosing one then fills the client in. This is the only state where the
  // owner's name earns its place in the option — once the list is narrowed
  // every row would carry the same name, which is noise, not confirmation.
  const choosablePets = clientId
    ? (pets ?? []).filter((p) => p.ownerId === clientId)
    : (pets ?? []);
  const petOptions = choosablePets.map((p) => ({
    value: p.id,
    label: clientId ? p.name : `${p.name} · ${p.ownerName}`,
  }));

  // Adjusted during render rather than in an effect: an effect would paint
  // the stale animal for a frame and then blank it. Same pattern as
  // `action-form.tsx`.
  //
  // Only an animal whose owner we know. The search is attached only
  // while no client is chosen, so anything reached through it has
  // already filled the client in with its own owner and the two agree
  // by construction; an animal whose owner is unknown to both would be
  // thrown away here as readily when the choice was right as when it
  // was wrong, and the server refuses a real mismatch
  // (`modules/reminders/service.ts`).
  const heldOwner = pet
    ? (pets?.find((p) => p.id === pet.value)?.ownerId ?? petOwner?.value)
    : undefined;
  if (clientId && heldOwner && heldOwner !== clientId) setPet(null);

  const defaultDue = useMemo(
    // eslint-disable-next-line react-hooks/purity -- one-shot initial value, never recomputed
    () => new Date(Date.now() + 7 * 86400 * 1000),
    [],
  );

  useEffect(() => {
    if (state.success) {
      reset();
      toast.success(tCommon("saved"));
    }
    // No `toast.error`: the rule and its reasoning live in
    // `action-form.tsx`, which owns the box a failure goes into.
  }, [state.success, tCommon, reset]);

  // These two are held up here, so `reset()` — which clears the
  // uncontrolled fields — cannot reach them. Adjusted during render for the
  // reason above, and keyed on the token `reset()` increments.
  const [seenReset, setSeenReset] = useState(form.resetToken);
  if (seenReset !== form.resetToken) {
    setSeenReset(form.resetToken);
    setClient(initialClient);
    setPet(initialPet);
    setPetOwner(null);
    setContact(handedContact.get(defaultClientId ?? "") ?? null);
  }

  /**
   * Why no message will reach this client, or null when one will.
   *
   * Same order as `reminderDeliveryState` on the server, and that is the
   * point rather than a coincidence: the form and the row have to give the
   * same answer about the same client, or the vet is told one thing before
   * saving and another one line later.
   *
   * The reminder is still saved. It is a note to the vet as much as a
   * message to the owner, and refusing to write it down would take away
   * the half that does work -- the screen says what will not happen, it
   * does not decide for anyone.
   */
  const unreachable =
    !contact
      ? null
      : contact.notificationsOptIn === null
        ? "neverAsked"
        : contact.notificationsOptIn === false
          ? "optedOut"
          : !contact.phone
            ? "noPhone"
            : null;

  return (
    <ActionForm
      form={form}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field
        label={tClient("one")}
        error={state.fieldErrors?.clientId}
        required
      >
        {/* See `InvoiceForm`: searchable only once the list is short of
            the whole clinic. Until this the picker was a plain select
            over the capped fifty, so a clinic's fifty-first client could
            not be reminded of anything at all. */}
        <Combobox
          name="clientId"
          required
          options={clientOptions}
          value={client}
          onValueChange={(_, option) => {
            setClient(option);
            setContact(option ? contactFor(option.value) : null);
          }}
          placeholder={tCommon("searchOrType")}
          noResultsLabel={tCommon("noResults")}
          onSearch={clientsCapped ? searchClients : undefined}
          hasMore={clientsCapped}
          searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
          hasMoreLabel={tCommon("searchMore")}
        />
      </Field>
      {pets && (
        <Field label={tPet("one")} error={state.fieldErrors?.petId}>
          {/* Searchable only while the list still spans the clinic. Once
              a client is chosen the list is theirs, and the search
              answers clinic-wide: attaching it there would put other
              people's animals back into a list narrowed on purpose, and
              filtering its twenty hits down to one owner afterwards
              would report "no results" for an animal that is on file.
              Narrowing belongs in the query (`quickSearchPets`), and
              until it is there this picker stays short of its animals
              in a clinic past the cap. */}
          <Combobox
            name="petId"
            options={petOptions}
            value={pet}
            onValueChange={(v, option) => {
              setPet(option);
              // Picking the animal first is the natural order, so it
              // answers the client question rather than leaving it to be
              // answered twice — from the handed list or from the
              // search, which returns the owner alongside the label.
              const handed = pets.find((p) => p.id === v);
              const owner = handed
                ? { value: handed.ownerId, label: handed.ownerName }
                : searchedOwners.current.get(v);
              setPetOwner(owner ?? null);
              if (owner) {
                setClient(owner);
                // An owner reached through an animal found by search
                // arrives with a name and nothing else, so this is `null`
                // and the warning stays quiet. Not a silent gap worth
                // papering over: saying "no consent" about a client whose
                // consent we have not read would be a wrong warning, and
                // a wrong one costs more than a missing one. The list
                // itself still says it, on the row, after saving.
                setContact(contactFor(owner.value));
              }
            }}
            placeholder={tCommon("searchOrType")}
            noResultsLabel={tCommon("noResults")}
            // No longer `&& !clientId`. The search used to be taken
            // away the moment a client was chosen, because it could
            // only answer clinic-wide; now it narrows, so the case it
            // was withheld from is the case it is most needed in —
            // the owner of a hundred animals, on the page where you
            // already know whose they are.
            //
            // `hasMore` still tracks the clinic-wide cap, which
            // over-claims in one case: a clinic of sixty whose chosen
            // client has two animals, both inside the first fifty, is
            // told there may be more when there are not. Left that
            // way on purpose. The note is an instruction rather than a
            // count, and the two errors are not the same size — being
            // told to type when you need not costs a second, and not
            // being told costs a duplicate record.
            onSearch={petsCapped ? searchPets : undefined}
            hasMore={Boolean(petsCapped)}
            searchHintLabel={tCommon("searchMinChars")}
            searchingLabel={tCommon("searching")}
            searchFailedLabel={tCommon("searchFailed")}
            hasMoreLabel={tCommon("searchMore")}
          />
        </Field>
      )}
      <Field label={t("type")} error={state.fieldErrors?.type} required>
        <Select name="type" defaultValue="CHECKUP" required>
          {REMINDER_TYPES.map((r) => (
            <option key={r} value={r}>
              {tType(r)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("dueAt")} error={state.fieldErrors?.dueAt} required>
        <DateTimeInput
          name="dueAt"
          defaultValue={defaultDue}
          granularity="day"
          required
        />
      </Field>
      {/* Under the two pickers, before the fields that describe the work:
          the answer belongs next to the question that produced it, and a
          notice below the save button is read after the decision it was
          meant to inform. `live`, because it appears in response to a
          choice rather than as part of the first paint. */}
      {unreachable && (
        <div className="sm:col-span-2">
          <Callout variant="warning" live>
            {t(`unreachable.${unreachable}`)} {t("unreachable.savedAnyway")}
          </Callout>
        </div>
      )}
      <div className="sm:col-span-2">
        <Field label={t("name")} error={state.fieldErrors?.title} required>
          <Input name="title" required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t("body")} error={state.fieldErrors?.body}>
          <Textarea name="body" rows={3} />
        </Field>
      </div>
      <SubmitButton size="sm" className="sm:col-span-2 w-fit">
        {t("create")}
      </SubmitButton>
    </ActionForm>
  );
}
