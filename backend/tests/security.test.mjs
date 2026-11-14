import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  sid = "c1111111-1111-4111-8111-111111111111";
async function as(id, fn) {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;create function storage.filename(text) returns text language sql immutable as $$select (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)]$$;create publication supabase_realtime;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130002_storage.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130004_calendar_service.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130005_integrity.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130003_allowlist.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130006_automatic_calendar.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130007_calendar_recurrence.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130008_youtube.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    `insert into auth.users(id,email) values ($1,'jcusilaymeg@gmail.com'),($2,'032azq@gmail.com'),($3,'stranger@example.com')`,
    [a, b, c],
  );
  await as(a, () =>
    db.query("select public.save_entry($1,'Antes de compartir')", [
      JSON.stringify({
        kind: "mood",
        title: "Registro existente",
        visibility: "private",
        details: { mood: "bien" },
      }),
    ]),
  );
  await as(a, () =>
    db.query(
      "insert into public.photos(id,space_id,title,storage_path,thumb_path,captured_at,captured_at_source,size_bytes,width,height) values('99999999-9999-4999-8999-999999999999',$1,'Foto existente',$2,$3,now(),'manual',100,10,10)",
      [
        sid,
        sid + "/99999999-9999-4999-8999-999999999999/full.webp",
        sid + "/99999999-9999-4999-8999-999999999999/thumb.webp",
      ],
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611130009_shared_space.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const name of [
    "202611130010_universe_bank.sql",
    "202611130011_date_ideas.sql",
    "202611130012_schedule_dates.sql",
    "202611130013_web_push.sql",
    "202611130014_gmail_notifications.sql",
    "202611130015_lived_dates.sql",
    "202611130016_task_carryover.sql",
    "202611130017_finances.sql",
    "202611130018_finance_people_goals.sql",
    "202611130019_connection_alerts.sql",
    "202611130020_shared_dates.sql",
    "202611130021_question_management.sql",
    "202611130022_shared_watch_status.sql",
    "202611130023_restore_watch_owner_status.sql",
    "202611130024_shared_watch_status.sql",
  ]) {
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  }
});
after(() => db.close());

test("question bank has 300 original prompts across 20 topics and three depths without removing existing questions", async () => {
  const bank = (
    await as(a, () =>
      db.query(
        "select category,depth,title,source_id from public.questions where bank_key is not null",
      ),
    )
  ).rows;
  assert.equal(bank.length, 300);
  assert.equal(new Set(bank.map((q) => q.category)).size, 20);
  for (const n of [1, 2, 3])
    assert.equal(bank.filter((q) => q.depth === n).length, 100);
  assert.equal(
    new Set(
      bank.map((q) =>
        q.title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
      ),
    ).size,
    300,
  );
  assert.ok(bank.every((q) => q.title.length <= 240 && q.source_id));
  assert.equal(
    (
      await as(a, () =>
        db.query("select * from public.questions where bank_key is null"),
      )
    ).rows.length,
    6,
  );
  assert.equal(
    (await as(c, () => db.query("select * from public.questions"))).rows.length,
    0,
  );
  assert.equal(
    (await as(c, () => db.query("select * from public.question_sources"))).rows
      .length,
    0,
  );
  const seed = readFileSync(
    new URL(
      "../supabase/migrations/202611130010_universe_bank.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(seed.slice(seed.indexOf("insert into public.questions(")));
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.questions where bank_key is not null",
      )
    ).rows[0].n,
    300,
  );
});

test("date ideas are shared and repeatable; either member can schedule and reschedule one linked event", async () => {
  const seed = readFileSync(
    new URL(
      "../supabase/migrations/202611130011_date_ideas.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(seed);
  const dates = (
    await as(b, () =>
      db.query("select * from public.entries where kind='date'"),
    )
  ).rows;
  assert.equal(dates.length, 150);
  assert.ok(
    dates.every((e) => e.visibility === "shared" && e.status === "pending"),
  );
  const id = dates[0].id;
  await db.query("select public.calendar_service('connect',$1,$2)", [
    a,
    JSON.stringify({
      token: "encrypted-date-test",
      calendar_id: "our-calendar",
    }),
  ]);
  const schedule = (uid, start, end) =>
    as(uid, () =>
      db.query("select public.schedule_date($1,$2,$3) id", [id, start, end]),
    );
  const first = (
    await schedule(a, "2027-03-12T23:00:00Z", "2027-03-13T01:00:00Z")
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select sync_google from public.calendar_events where id=$1",
        [first],
      )
    ).rows[0].sync_google,
    true,
  );
  assert.ok(
    (
      await db.query(
        "select generation from private.calendar_sync_queue where user_id=$1",
        [a],
      )
    ).rows[0].generation > 0,
  );
  assert.equal(
    (
      await as(b, () =>
        db.query("select calendar_event_id from public.entries where id=$1", [
          id,
        ]),
      )
    ).rows[0].calendar_event_id,
    first,
  );
  assert.equal(
    (await schedule(b, "2027-03-14T23:00:00Z", "2027-03-15T01:00:00Z")).rows[0]
      .id,
    first,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.calendar_events where id=$1",
        [first],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    () => schedule(c, "2027-03-12T23:00:00Z", "2027-03-13T01:00:00Z"),
    /disponible/,
  );
  await assert.rejects(
    () => schedule(a, "2027-03-12T23:00:00Z", "2027-03-12T22:00:00Z"),
    /horario/,
  );
});

test("migration shares existing mood notes and photos and forces shared writes", async () => {
  await as(b, async () => {
    const e = (
      await db.query(
        "select id,visibility from public.entries where title='Registro existente'",
      )
    ).rows[0];
    assert.equal(e.visibility, "shared");
    assert.equal(
      (
        await db.query(
          "select content from public.entry_bodies where entry_id=$1",
          [e.id],
        )
      ).rows[0].content,
      "Antes de compartir",
    );
    assert.equal(
      (
        await db.query(
          "select visibility from public.photos where title='Foto existente'",
        )
      ).rows[0].visibility,
      "shared",
    );
  });
  await as(a, async () => {
    await db.query(
      "update public.photos set visibility='private' where title='Foto existente'",
    );
    assert.equal(
      (
        await db.query(
          "select visibility from public.photos where title='Foto existente'",
        )
      ).rows[0].visibility,
      "shared",
    );
  });
});

test("YouTube credentials are service-only, state single-use, and both members share one locked playlist", async () => {
  await assert.rejects(() =>
    as(a, () =>
      db.query("select public.youtube_service('connection',$1)", [a]),
    ),
  );
  await assert.rejects(() =>
    as(b, () => db.query("select * from private.youtube_connections")),
  );
  await assert.rejects(() =>
    db.query("select public.youtube_service('connection',$1)", [c]),
  );
  await db.query("select public.youtube_service('connect',$1,$2)", [
    a,
    JSON.stringify({ token: "encrypted-test-only" }),
  ]);
  await db.query("select public.youtube_service('state',$1,$2)", [
    a,
    JSON.stringify({ state: "youtube-state", verifier: "pkce" }),
  ]);
  assert.equal(
    (await db.query("select public.consume_youtube_state('youtube-state') s"))
      .rows[0].s.user_id,
    a,
  );
  assert.equal(
    (await db.query("select public.consume_youtube_state('youtube-state') s"))
      .rows[0].s,
    null,
  );
  assert.equal(
    (await db.query("select public.youtube_service('lock',$1) s", [a])).rows[0]
      .s.acquired,
    true,
  );
  assert.equal(
    (await db.query("select public.youtube_service('lock',$1) s", [b])).rows[0]
      .s.acquired,
    false,
  );
  await db.query("select public.youtube_service('save',$1,$2)", [
    a,
    JSON.stringify({ id: "playlist-test", title: "Nuestro soundtrack" }),
  ]);
  const shared = (
    await db.query("select public.youtube_service('playlist',$1) s", [b])
  ).rows[0].s;
  assert.equal(shared.playlist_id, "playlist-test");
  assert.equal(shared.owner_id, a);
  await assert.rejects(() =>
    db.query("select public.youtube_service('save',$1,$2)", [
      b,
      JSON.stringify({ id: "replacement", title: "Other" }),
    ]),
  );
  await db.query("select public.youtube_service('unlock',$1)", [a]);
  await db.query("select public.youtube_service('disconnect',$1)", [a]);
  assert.equal(
    (await db.query("select public.youtube_service('playlist',$1) s", [b]))
      .rows[0].s.token,
    null,
  );
});
test("calendar series are shared, retain recurrence, and delete as one sequence", async () => {
  const rules = ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"];
  const e = (
    await as(a, () =>
      db.query(
        "insert into public.calendar_events(space_id,title,start_at,end_at,visibility,recurrence) values($1,'Una serie semanal',now()+interval '1 day',now()+interval '1 day 1 hour','private',$2) returning *",
        [sid, rules],
      ),
    )
  ).rows[0];
  assert.equal(e.visibility, "shared");
  assert.deepEqual(e.recurrence, rules);
  await as(b, async () =>
    assert.equal(
      (
        await db.query("select id from public.calendar_events where id=$1", [
          e.id,
        ])
      ).rows.length,
      1,
    ),
  );
  await db.exec("set request.jwt.claim.sub=''");
  await db.query("select public.import_calendar_override($1,$2)", [
    a,
    JSON.stringify({
      event_id: e.id,
      google_event_id: "exception-one",
      original_start: "2026-11-23T14:00:00Z",
      cancelled: true,
    }),
  ]);
  await as(b, async () =>
    assert.equal(
      (
        await db.query(
          "select * from public.calendar_overrides where event_id=$1",
          [e.id],
        )
      ).rows.length,
      1,
    ),
  );
  await as(c, async () => {
    assert.equal(
      (
        await db.query(
          "select * from public.calendar_overrides where event_id=$1",
          [e.id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.calendar_invitees($1)", [a]),
      /permission denied/,
    );
  });
  assert.deepEqual(
    (
      await db.query("select public.calendar_invitees($1) as emails", [a])
    ).rows[0].emails.sort(),
    ["032azq@gmail.com", "jcusilaymeg@gmail.com"].sort(),
  );
  await as(a, () =>
    db.query("select public.trash_item('calendar_events',$1)", [e.id]),
  );
  await as(b, async () => {
    assert.equal(
      (
        await db.query("select * from public.calendar_events where id=$1", [
          e.id,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.calendar_overrides where event_id=$1",
          [e.id],
        )
      ).rows.length,
      0,
    );
  });
});
test("connected calendar exports inserts, edits and trash automatically without exporting quests or looping imports", async () => {
  await db.exec("set request.jwt.claim.sub=''");
  await db.query("select public.calendar_service('connect',$1,$2)", [
    a,
    JSON.stringify({
      token: "encrypted-test",
      calendar_id: "only-our-calendar",
    }),
  ]);
  const event = (
    await as(a, () =>
      db.query(
        "insert into public.calendar_events(space_id,title,start_at,end_at) values($1,'Horario automático',now()+interval '1 day',now()+interval '1 day 1 hour') returning *",
        [sid],
      ),
    )
  ).rows[0];
  assert.equal(event.sync_google, true);
  const generation = async () =>
    Number(
      (
        await db.query(
          "select generation from private.calendar_sync_queue where user_id=$1",
          [a],
        )
      ).rows[0].generation,
    );
  const first = await generation();
  await as(a, () =>
    db.query(
      "insert into public.tasks(space_id,title) values($1,'Una quest sin exportar')",
      [sid],
    ),
  );
  assert.equal(await generation(), first);
  await db.exec("set request.jwt.claim.sub=''");
  await db.query("select public.calendar_service('import',$1,$2)", [
    a,
    JSON.stringify({ event_id: event.id, title: "Cambio desde Google" }),
  ]);
  assert.equal(
    await generation(),
    first,
    "Google imports must not re-enqueue themselves",
  );
  await as(a, () =>
    db.query(
      "update public.calendar_events set title='Horario corregido' where id=$1",
      [event.id],
    ),
  );
  assert.equal(await generation(), first + 1);
  await as(a, () =>
    db.query("select public.trash_item('calendar_events',$1)", [event.id]),
  );
  assert.equal(await generation(), first + 2);
  await as(a, () =>
    db.query("select public.trash_item('calendar_events',$1,true)", [event.id]),
  );
  assert.equal(await generation(), first + 3);
  await db.query("select public.complete_calendar_sync($1,$2)", [a, first]);
  assert.notEqual(
    (await db.query("select public.pending_calendar_sync($1) as pending", [a]))
      .rows[0].pending,
    null,
    "Older jobs must not acknowledge newer edits",
  );
  await as(a, async () =>
    assert.rejects(
      db.query("select public.pending_calendar_sync($1)", [a]),
      /permission denied/,
    ),
  );
});
test("answers can be edited by their author without changing ownership", async () => {
  const q = (
    await as(a, () => db.query("select id from public.questions limit 1"))
  ).rows[0].id;
  const ans = (
    await as(a, () =>
      db.query(
        "insert into public.answers(space_id,question_id,answer) values($1,$2,'Una canción') returning id",
        [sid, q],
      ),
    )
  ).rows[0].id;
  await as(a, () =>
    db.query("update public.answers set answer='Un abrazo' where id=$1", [ans]),
  );
  await as(a, async () =>
    assert.equal(
      (await db.query("select answer from public.answers where id=$1", [ans]))
        .rows[0].answer,
      "Un abrazo",
    ),
  );
  await as(b, async () =>
    assert.equal(
      (
        await db.query(
          "update public.answers set answer='No soy el autor' where id=$1 returning id",
          [ans],
        )
      ).rows.length,
      0,
    ),
  );
  await as(a, async () =>
    assert.rejects(
      db.query("update public.answers set respondent_id=$1 where id=$2", [
        b,
        ans,
      ]),
      /permission denied/,
    ),
  );
});
test("soft deletion hides shared content from the partner and restoration recovers it", async () => {
  const id = (
    await as(a, () =>
      db.query("select public.save_entry($1,$2) as id", [
        JSON.stringify({
          kind: "journal",
          title: "Un recuerdo restaurable",
          visibility: "shared",
        }),
        "Nuestra historia",
      ]),
    )
  ).rows[0].id;
  await as(a, () => db.query("select public.trash_item('entries',$1)", [id]));
  await as(b, async () => {
    assert.equal(
      (await db.query("select * from public.entries where id=$1", [id])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query("select * from public.entry_bodies where entry_id=$1", [
          id,
        ])
      ).rows.length,
      0,
    );
  });
  await as(a, () =>
    db.query("select public.trash_item('entries',$1,true)", [id]),
  );
  await as(b, async () =>
    assert.equal(
      (
        await db.query(
          "select content from public.entry_bodies where entry_id=$1",
          [id],
        )
      ).rows[0].content,
      "Nuestra historia",
    ),
  );
});
test("scheduled reminders are deduplicated and calendar events notify both members", async () => {
  const task = (
    await as(a, () =>
      db.query(
        "insert into public.tasks(space_id,title) values($1,'Un reporte pendiente') returning id",
        [sid],
      ),
    )
  ).rows[0];
  const progress = (
    await as(a, () =>
      db.query("select public.report_task_progress($1,50) as id", [task.id]),
    )
  ).rows[0];
  await db.query(
    "update public.task_progress set created_at=now()-interval '74 hours' where id=$1",
    [progress.id],
  );
  const event = (
    await as(a, () =>
      db.query(
        "insert into public.calendar_events(space_id,title,start_at,end_at) values($1,'Un evento privado',now()+interval '30 minutes',now()+interval '90 minutes') returning id",
        [sid],
      ),
    )
  ).rows[0];
  await db.query("select public.enqueue_reminders()");
  await db.query("select public.enqueue_reminders()");
  const reminders = (
    await db.query(
      "select * from public.notifications where dedupe_key like $1",
      ["reminder:" + progress.id + ":%"],
    )
  ).rows;
  assert.equal(reminders.length, 2);
  assert(reminders.every((n) => n.recipient_id === b));
  const events = (
    await db.query(
      "select * from public.notifications where dedupe_key like $1",
      ["event-reminder:" + event.id + ":%"],
    )
  ).rows;
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.recipient_id).sort(), [a, b].sort());
});
test("both members read mood notes and finances, including legacy private submissions", async () => {
  const create = async (kind, extra = {}) =>
    (
      await as(a, () =>
        db.query("select public.save_entry($1,$2) id", [
          JSON.stringify({
            kind,
            title: "Nuestro registro",
            visibility: "private",
            ...extra,
          }),
          "Nuestra nota",
        ]),
      )
    ).rows[0].id;
  const mood = await create("mood", { details: { mood: "bien" } });
  const tx = await create("transaction", {
    amount: 500,
    details: { direction: "income" },
  });
  for (const id of [mood, tx])
    await as(b, async () => {
      assert.equal(
        (
          await db.query("select visibility from public.entries where id=$1", [
            id,
          ])
        ).rows[0].visibility,
        "shared",
      );
      assert.equal(
        (
          await db.query(
            "select content from public.entry_bodies where entry_id=$1",
            [id],
          )
        ).rows[0].content,
        "Nuestra nota",
      );
    });
  await as(c, async () =>
    assert.equal(
      (
        await db.query("select * from public.entry_bodies where entry_id=$1", [
          mood,
        ])
      ).rows.length,
      0,
    ),
  );
});

test("photo object access follows metadata visibility and ignores guessed storage paths", async () => {
  const pid = "77777777-7777-4777-8777-777777777777";
  const path = sid + "/" + pid + "/full.webp";
  await as(a, () =>
    db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values('photos',$1,$2)",
      [path, a],
    ),
  );
  await as(a, () =>
    db.query(
      `insert into public.photos(id,space_id,title,storage_path,thumb_path,captured_at,captured_at_source,size_bytes,width,height) values($1,$2,'Nuestra foto',$3,$4,now(),'manual',1000,100,100)`,
      [pid, sid, path, sid + "/" + pid + "/thumb.webp"],
    ),
  );
  await as(a, async () =>
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows.length,
      1,
    ),
  );
  await as(b, async () =>
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows.length,
      1,
    ),
  );
  await as(a, () =>
    db.query("update public.photos set visibility='shared' where id=$1", [pid]),
  );
  await as(b, async () =>
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows.length,
      1,
    ),
  );
  await as(c, async () => {
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('photos',$1,$2)",
        [sid + "/88888888-8888-4888-8888-888888888888/full.webp", c],
      ),
      /row-level security/,
    );
  });
});
test("OAuth state is single-use, tokens are service-only and sync locks are exclusive", async () => {
  await as(a, async () => {
    await assert.rejects(
      db.query("select public.calendar_service('connection',$1)", [a]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from private.google_connections"),
      /permission denied/,
    );
  });
  await db.query("select public.calendar_service('connect',$1,$2)", [
    a,
    JSON.stringify({
      token: "encrypted-test-only",
      calendar_id: "only-created-by-app",
    }),
  ]);
  await db.query("select public.calendar_service('state',$1,$2)", [
    a,
    JSON.stringify({
      state: "nonce",
      verifier: "verifier",
      redirect_uri: "https://example.test/callback",
    }),
  ]);
  assert.equal(
    (await db.query("select public.consume_calendar_state('nonce') as state"))
      .rows[0].state.user_id,
    a,
  );
  assert.equal(
    (await db.query("select public.consume_calendar_state('nonce') as state"))
      .rows[0].state,
    null,
  );
  assert.equal(
    (await db.query("select public.calendar_service('lock',$1) as state", [a]))
      .rows[0].state.acquired,
    true,
  );
  assert.equal(
    (await db.query("select public.calendar_service('lock',$1) as state", [a]))
      .rows[0].state.acquired,
    false,
  );
  await db.query("select public.calendar_service('finish',$1)", [a]);
  assert.equal(
    (await db.query("select public.calendar_service('lock',$1) as state", [a]))
      .rows[0].state.acquired,
    true,
  );
});
test("only the allowlisted two accounts receive memberships", async () => {
  assert.equal(
    (await db.query("select * from public.space_members")).rows.length,
    2,
  );
  await as(c, async () =>
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      0,
    ),
  );
});
test("cross-verification is transactional, immutable and cannot be bypassed", async () => {
  const {
    rows: [task],
  } = await as(a, () =>
    db.query(
      "insert into public.tasks(space_id,title,assignee_id) values($1,$2,$3) returning *",
      [sid, "Preparar nuestro viaje", a],
    ),
  );
  await as(b, async () =>
    assert.rejects(
      db.query("select public.report_task_progress($1,80,'')", [task.id]),
      /responsable/,
    ),
  );
  const {
    rows: [p],
  } = await as(a, () =>
    db.query(
      "select public.report_task_progress($1,80,'Primera versión') as id",
      [task.id],
    ),
  );
  await as(a, async () =>
    assert.rejects(
      db.query("select public.verify_task_progress($1,'approve')", [p.id]),
      /propio/,
    ),
  );
  await as(b, async () => {
    await assert.rejects(
      db.query("select public.verify_task_progress($1,'partial',90)", [p.id]),
      /reportado/,
    );
    await assert.rejects(
      db.query("select public.verify_task_progress($1,'reject',null,'no')", [
        p.id,
      ]),
      /10 caracteres/,
    );
    await db.query("select public.verify_task_progress($1,'partial',60)", [
      p.id,
    ]);
    await assert.rejects(
      db.query("select public.verify_task_progress($1,'approve')", [p.id]),
      /resuelto/,
    );
  });
  const t = (
    await db.query("select * from public.tasks where id=$1", [task.id])
  ).rows[0];
  assert.equal(t.reported_percent, 80);
  assert.equal(t.verified_percent, 60);
  await as(a, async () => {
    await assert.rejects(
      db.query("update public.tasks set verified_percent=100 where id=$1", [
        task.id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("delete from public.task_progress where id=$1", [p.id]),
      /permission denied/,
    );
  });
});
test("superseded reports cannot be verified; latest completion retains history", async () => {
  const {
    rows: [t],
  } = await as(a, () =>
    db.query(
      "insert into public.tasks(space_id,title) values($1,'Una tarea compartida') returning id",
      [sid],
    ),
  );
  const p1 = (
    await as(a, () =>
      db.query("select public.report_task_progress($1,50) as id", [t.id]),
    )
  ).rows[0].id;
  const p2 = (
    await as(b, () =>
      db.query("select public.report_task_progress($1,100) as id", [t.id]),
    )
  ).rows[0].id;
  await as(b, async () =>
    assert.rejects(
      db.query("select public.verify_task_progress($1,'approve')", [p1]),
      /resuelto/,
    ),
  );
  await as(a, () =>
    db.query("select public.verify_task_progress($1,'approve')", [p2]),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.task_progress where task_id=$1",
        [t.id],
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (await db.query("select status from public.tasks where id=$1", [t.id]))
      .rows[0].status,
    "done",
  );
});
test("records are shared and capsules cannot be read or changed before opening", async () => {
  const create = async (data, body) =>
    as(a, () =>
      db.query("select public.save_entry($1,$2) as id", [
        JSON.stringify(data),
        body,
      ]),
    );
  const privateId = (
    await create({ kind: "journal", title: "Nuestro diario" }, "Nuestra nota")
  ).rows[0].id;
  const capsuleId = (
    await create(
      {
        kind: "journal",
        title: "Una sorpresa",
        visibility: "capsule",
        unlock_at: "2099-01-01T00:00:00Z",
      },
      "El secreto",
    )
  ).rows[0].id;
  await as(b, async () => {
    assert.equal(
      (await db.query("select * from public.entries where id=$1", [privateId]))
        .rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from public.entry_bodies where entry_id=$1", [
          capsuleId,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.save_entry($1,'alterado',$2)", [
        JSON.stringify({ kind: "journal", title: "Hack" }),
        privateId,
      ]),
      /editar/,
    );
  });
  await as(a, async () => {
    assert.equal(
      (
        await db.query("select * from public.entry_bodies where entry_id=$1", [
          capsuleId,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.save_entry($1,'alterado',$2)", [
        JSON.stringify({ kind: "journal", title: "Cambio" }),
        capsuleId,
      ]),
      /sellada/,
    );
  });
  await as(c, async () =>
    assert.equal(
      (await db.query("select * from public.entries")).rows.length,
      0,
    ),
  );
});
test("foreign user cannot forge memberships or notifications", async () => {
  await as(c, async () => {
    assert.equal(
      (await db.query("select * from public.questions")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("insert into public.space_members values($1,$2)", [sid, c]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.notifications(recipient_id,kind,title) values($1,'x','x')",
        [a],
      ),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select * from public.notifications")).rows.length,
      0,
    );
  });
});

test("push subscriptions belong to one member, move with the browser and never leak keys", async () => {
  const ep = "https://push.example.test/send/device-1";
  const keys = ["B".repeat(87), "a".repeat(22)];
  await as(c, () =>
    assert.rejects(
      db.query("select public.save_push_subscription($1,$2,$3,'X')", [ep, ...keys]),
      /Inicia sesión/,
    ),
  );
  await as(a, () =>
    db.query("select public.save_push_subscription($1,$2,$3,'Chrome · Windows')", [ep, ...keys]),
  );
  await as(a, () =>
    db.query("select public.save_push_subscription($1,$2,$3,'Chrome · Windows')", [ep, ...keys]),
  );
  const mine = (await as(a, () => db.query("select id,label from public.push_subscriptions"))).rows;
  assert.equal(mine.length, 1);
  assert.equal((await as(b, () => db.query("select id from public.push_subscriptions"))).rows.length, 0);
  await as(a, () => assert.rejects(db.query("select p256dh from public.push_subscriptions"), /permission denied/));
  await as(a, () =>
    assert.rejects(
      db.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4)", [a, ep + "x", ...keys]),
      /permission denied/,
    ),
  );
  await as(a, () =>
    assert.rejects(
      db.query("select public.save_push_subscription('http://insecure.test/x',$1,$2,'X')", keys),
      /check constraint/,
    ),
  );
  // Same browser, other member signs in: the device now notifies only that member.
  await as(b, () => db.query("select public.save_push_subscription($1,$2,$3,'Safari · iPhone')", [ep, ...keys]));
  assert.equal((await as(a, () => db.query("select id from public.push_subscriptions"))).rows.length, 0);
  await as(a, () => db.query("select public.remove_push_subscription($1)", [ep]));
  assert.equal((await as(b, () => db.query("select id from public.push_subscriptions"))).rows.length, 1);
  // Without pg_net/vault the trigger is a no-op and the in-app notification is kept.
  await db.query("insert into public.notifications(recipient_id,kind,title) values($1,'test','Hola')", [b]);
  assert.equal((await as(b, () => db.query("select id from public.notifications where kind='test'"))).rows.length, 1);
  await as(b, () => db.query("select public.remove_push_subscription($1)", [ep]));
  assert.equal((await db.query("select count(*)::int n from public.push_subscriptions")).rows[0].n, 0);
});
test("email fallback goes from the partner's Gmail, only without push, once, and never exposes tokens", async () => {
  const note = async (to, title) =>
    (await db.query("insert into public.notifications(recipient_id,kind,title,path) values($1,'mail_test',$2,'/dia/quests') returning id", [to, title])).rows[0].id;
  // Nobody connected Gmail: nothing to send.
  let n = await note(a, "Sin remitente");
  assert.equal((await db.query("select public.mail_plan($1) p", [n])).rows[0].p, null);
  await db.query("select public.gmail_service('connect',$1,$2)", [b, { email: "b@example.test", token: "enc-b" }]);
  await db.query("select public.gmail_service('connect',$1,$2)", [a, { email: "a@example.test", token: "enc-a" }]);
  // A notification for A is sent from B's Gmail (the partner), to A's account email.
  n = await note(a, "Te toca verificar");
  let plan = (await db.query("select public.mail_plan($1) p", [n])).rows[0].p;
  assert.equal(plan.sender_id, b);
  assert.equal(plan.token, "enc-b");
  assert.equal(plan.self, false);
  assert.equal(plan.to, (await db.query("select email from auth.users where id=$1", [a])).rows[0].email);
  await db.query("select public.mail_delivered($1,$2,'sent')", [n, b]);
  assert.equal((await db.query("select public.mail_plan($1) p", [n])).rows[0].p, null, "never twice");
  // Without the partner's connection, A's own Gmail mails A.
  await db.query("select public.gmail_service('disconnect',$1)", [b]);
  plan = (await db.query("select public.mail_plan($1) p", [await note(a, "Recordatorio")])).rows[0].p;
  assert.equal(plan.sender_id, a);
  assert.equal(plan.self, true);
  // Push is the primary channel: with an active device, no email.
  await as(a, () => db.query("select public.save_push_subscription('https://push.example.test/a',$1,$2,'X')", ["B".repeat(87), "a".repeat(22)]));
  assert.equal((await db.query("select public.mail_plan($1) p", [await note(a, "Con push")])).rows[0].p, null);
  await as(a, () => db.query("select public.remove_push_subscription('https://push.example.test/a')"));
  // Read notifications are not mailed.
  n = await note(a, "Leída");
  await db.query("update public.notifications set read_at=now() where id=$1", [n]);
  assert.equal((await db.query("select public.mail_plan($1) p", [n])).rows[0].p, null);
  // Members see only their own status, never tokens; outsiders and clients cannot reach the service.
  const status = (await as(a, () => db.query("select public.gmail_status() s"))).rows[0].s;
  assert.equal(status.connected, true);
  assert.equal(status.email, "a@example.test");
  assert.equal(status.partner_connected, false);
  assert.ok(!JSON.stringify(status).includes("enc-"));
  assert.equal((await as(c, () => db.query("select public.gmail_status() s"))).rows[0].s, null);
  await as(a, () => assert.rejects(db.query("select public.mail_plan($1)", [n]), /permission denied/));
  await as(a, () => assert.rejects(db.query("select public.gmail_service('disconnect',$1)", [b]), /permission denied/));
  await as(a, () => assert.rejects(db.query("select * from private.gmail_connections"), /permission denied/));
  await db.query("select public.gmail_service('disconnect',$1)", [a]);
  await db.query("delete from public.notifications where kind='mail_test'");
});

test("either member records a lived date with a past day, an optional photo and a note; the partner is told once", async () => {
  const [idea] = (await as(a, () => db.query("select id,owner_id from public.entries where kind='date' and status='pending' and deleted_at is null order by id limit 1"))).rows;
  const photo = "88888888-8888-4888-8888-888888888888";
  await as(b, () =>
    db.query(
      "insert into public.photos(id,space_id,title,storage_path,thumb_path,captured_at,captured_at_source,size_bytes,width,height) values($1,$2,'Cita',$3,$4,'2026-02-14T12:00:00Z','manual',100,10,10)",
      [photo, sid, sid + "/" + photo + "/full.webp", sid + "/" + photo + "/thumb.webp"],
    ),
  );
  const live = (uid, day, note, pid = null) =>
    as(uid, () => db.query("select public.complete_date($1,$2,$3,$4)", [idea.id, day, note, pid]));
  // B lives an idea created by A, on a day before Chimuverse existed.
  await live(b, "2026-02-14", "  Nos perdimos y fue lo mejor  ", photo);
  let row = (await as(a, () => db.query("select status,occurred_on::text d,details,owner_id from public.entries where id=$1", [idea.id]))).rows[0];
  assert.equal(row.status, "done");
  assert.equal(row.d, "2026-02-14");
  assert.equal(row.owner_id, idea.owner_id);
  assert.equal(row.details.memory_note, "Nos perdimos y fue lo mejor");
  assert.equal(row.details.photo_id, photo);
  assert.equal(row.details.lived_by, b);
  const told = async () =>
    (await db.query("select recipient_id from public.notifications where kind='date_lived' and dedupe_key like $1", ["date-lived:" + idea.id + "%"])).rows;
  assert.deepEqual((await told()).map((r) => r.recipient_id), [a]);
  // Editing the memory (removing the photo, new note) keeps the idea's data and does not notify again.
  await live(a, "2026-02-15", "", null);
  row = (await db.query("select occurred_on::text d,details from public.entries where id=$1", [idea.id])).rows[0];
  assert.equal(row.d, "2026-02-15");
  assert.equal(row.details.photo_id, undefined);
  assert.equal(row.details.memory_note, undefined);
  assert.ok(row.details.category);
  assert.equal((await told()).length, 1);
  // Future days, long notes, foreign photos and outsiders are rejected.
  await assert.rejects(() => live(a, "2999-01-01", ""), /fecha/);
  await assert.rejects(() => live(a, "2026-02-15", "x".repeat(1001)), /1000/);
  await assert.rejects(() => live(a, "2026-02-15", "", "12345678-1234-4234-8234-123456789abc"), /Foto/);
  await assert.rejects(() => live(c, "2026-02-15", ""), /disponible/);
  await assert.rejects(() => as(a, () => db.query("select public.complete_date($1,'2026-02-15','',null)", [sid])), /disponible/);
});

test("unfinished tasks move to another day with a reason, either member edits them, and finished ones become history", async () => {
  const id = (await as(a, () => db.query("insert into public.tasks(space_id,title,assignee_id,due_on) values($1,'Lavar la ropa',$2,'2026-11-13') returning id", [sid, a]))).rows[0].id;
  // Reported 60 %, verified 60 %: not finished, so it is carried to tomorrow with the reason.
  const pid = (await as(a, () => db.query("select public.report_task_progress($1,60,'la mitad') id", [id]))).rows[0].id;
  await as(b, () => db.query("select public.verify_task_progress($1,'approve')", [pid]));
  await as(b, () => db.query("select public.postpone_task($1,'2026-11-14','Faltó tiempo, quedan las sábanas')", [id]));
  let t = (await db.query("select due_on::text d,verified_percent v,status,completed_at from public.tasks where id=$1", [id])).rows[0];
  assert.deepEqual([t.d, t.v, t.status, t.completed_at], ["2026-11-14", 60, "progress", null]);
  const events = async () => (await as(a, () => db.query("select kind,from_date::text f,to_date::text t,reason,changes,actor_id from public.task_events where task_id=$1 order by created_at", [id]))).rows;
  assert.deepEqual((await events()).map((e) => [e.kind, e.f, e.t, e.reason, e.actor_id]), [["postpone", "2026-11-13", "2026-11-14", "Faltó tiempo, quedan las sábanas", b]]);
  assert.equal((await db.query("select count(*)::int n from public.notifications where kind='task_postponed' and recipient_id=$1", [a])).rows[0].n, 1);
  // A reason is required, the day must move forward, outsiders are refused.
  await assert.rejects(() => as(a, () => db.query("select public.postpone_task($1,'2026-11-15','')", [id])), /motivo/);
  await assert.rejects(() => as(a, () => db.query("select public.postpone_task($1,'2026-11-14','Otra vez sin tiempo')", [id])), /posterior/);
  await assert.rejects(() => as(c, () => db.query("select public.postpone_task($1,'2026-11-20','No soy del espacio')", [id])), /disponible/);
  // B edits A's task (title and owner); progress stays and the change is recorded.
  await as(b, () => db.query("select public.edit_task($1,'Lavar y doblar la ropa','',$2,'2026-11-14')", [id, b]));
  t = (await db.query("select title,assignee_id,verified_percent v from public.tasks where id=$1", [id])).rows[0];
  assert.deepEqual([t.title, t.assignee_id, t.v], ["Lavar y doblar la ropa", b, 60]);
  const edit = (await events()).at(-1);
  assert.equal(edit.kind, "edit");
  assert.deepEqual(edit.changes.title, ["Lavar la ropa", "Lavar y doblar la ropa"]);
  assert.deepEqual(edit.changes.assignee_id, [a, b]);
  // Saving without changes records nothing; clients cannot write the log directly.
  await as(b, () => db.query("select public.edit_task($1,'Lavar y doblar la ropa','',$2,'2026-11-14')", [id, b]));
  assert.equal((await events()).length, 2);
  await assert.rejects(() => as(a, () => db.query("insert into public.task_events(task_id,actor_id,kind) values($1,$2,'edit')", [id, a])), /permission denied/);
  // Finishing it (100 % verified) stamps completed_at; history can no longer be edited or moved.
  const p2 = (await as(b, () => db.query("select public.report_task_progress($1,100,'listo') id", [id]))).rows[0].id;
  await as(a, () => db.query("select public.verify_task_progress($1,'approve')", [p2]));
  t = (await db.query("select status,completed_at from public.tasks where id=$1", [id])).rows[0];
  assert.equal(t.status, "done");
  assert.ok(t.completed_at);
  await assert.rejects(() => as(a, () => db.query("select public.edit_task($1,'Otra cosa','',null,'2026-11-20')", [id])), /historial/);
  await assert.rejects(() => as(a, () => db.query("select public.postpone_task($1,'2026-11-20','Ya no aplica')", [id])), /completada/);
});

test("an unfinished task whose day ended carries itself to today; finished ones stay where they are", async () => {
  const mk = async (title, status) =>
    (await db.query("insert into public.tasks(space_id,created_by,title,due_on,status) values($1,$2,$3,'2020-01-01',$4) returning id", [sid, a, title, status])).rows[0].id;
  const open = await mk("Ordenar el cuarto", "progress");
  const done = await mk("Cocinar juntos", "done");
  const today = (await db.query("select min((now() at time zone coalesce(p.timezone,'America/Lima'))::date)::text d from public.space_members m join public.profiles p on p.id=m.user_id where m.space_id=$1", [sid])).rows[0].d;
  assert.ok((await db.query("select public.carry_over_tasks() n")).rows[0].n >= 1);
  const due = async (id) => (await db.query("select due_on::text d from public.tasks where id=$1", [id])).rows[0].d;
  assert.equal(await due(open), today);
  assert.equal(await due(done), "2020-01-01");
  const ev = (await as(b, () => db.query("select kind,actor_id,from_date::text f,to_date::text t,reason from public.task_events where task_id=$1", [open]))).rows;
  assert.deepEqual(ev.map((e) => [e.kind, e.actor_id, e.f, e.t]), [["carry", null, "2020-01-01", today]]);
  assert.match(ev[0].reason, /pasó sola/);
  // Running again the same day changes nothing; members cannot trigger it.
  await db.query("select public.carry_over_tasks()");
  assert.equal((await db.query("select count(*)::int n from public.task_events where task_id=$1", [open])).rows[0].n, 1);
  await assert.rejects(() => as(a, () => db.query("select public.carry_over_tasks()")), /permission denied/);
});

test("a task's day changes only with a reason; discarding needs a reason and is recoverable; the reviewer adjusts progress", async () => {
  const id = (await as(a, () => db.query("insert into public.tasks(space_id,title,assignee_id,due_on) values($1,'Comprar el regalo',$2,'2026-11-20') returning id", [sid, a]))).rows[0].id;
  const edit = (uid, day) => as(uid, () => db.query("select public.edit_task($1,'Comprar el regalo','',$2,$3)", [id, a, day]));
  // Created today without progress: its date can still be fixed in place.
  await edit(a, "2026-11-21");
  // Once it has progress, the day only moves through "Pasar a otro día".
  const pid = (await as(a, () => db.query("select public.report_task_progress($1,40,'') id", [id]))).rows[0].id;
  await as(b, () => db.query("select public.verify_task_progress($1,'approve')", [pid]));
  await assert.rejects(() => edit(b, "2026-11-25"), /Pasar a otro día/);
  // The assignee cannot grade themself; the reviewer adjusts or resets with a reason, never to 100.
  await assert.rejects(() => as(a, () => db.query("select public.adjust_task_progress($1,80,'Ya avancé más')", [id])), /pareja/);
  await assert.rejects(() => as(b, () => db.query("select public.adjust_task_progress($1,100,'Está listo')", [id])), /100 %/);
  await assert.rejects(() => as(b, () => db.query("select public.adjust_task_progress($1,10,'')", [id])), /motivo/);
  await as(b, () => db.query("select public.adjust_task_progress($1,0,'Cambiamos de regalo, empezamos de cero')", [id]));
  let t = (await db.query("select verified_percent v,reported_percent r,status from public.tasks where id=$1", [id])).rows[0];
  assert.deepEqual([t.v, t.r, t.status], [0, 0, "pending"]);
  // Discard: reason required, leaves the open flow, takes no reports, is not carried, and can be recovered.
  await assert.rejects(() => as(a, () => db.query("select public.discard_task($1,'no')", [id])), /motivo/);
  await as(a, () => db.query("select public.discard_task($1,'Ya no hace falta, lo compró su mamá')", [id]));
  assert.equal((await db.query("select status from public.tasks where id=$1", [id])).rows[0].status, "discarded");
  await assert.rejects(() => as(a, () => db.query("select public.report_task_progress($1,50,'')", [id])), /reportes/);
  await assert.rejects(() => as(a, () => db.query("select public.postpone_task($1,'2026-12-01','Más adelante')", [id])), /descartada/);
  await db.query("update public.tasks set due_on='2020-01-01' where id=$1", [id]);
  await db.query("select public.carry_over_tasks()");
  assert.equal((await db.query("select due_on::text d from public.tasks where id=$1", [id])).rows[0].d, "2020-01-01");
  await as(b, () => db.query("select public.restore_task($1)", [id]));
  t = (await db.query("select status,due_on>=current_date-1 recent from public.tasks where id=$1", [id])).rows[0];
  assert.equal(t.status, "pending");
  assert.ok(t.recent);
  const kinds = (await as(a, () => db.query("select kind from public.task_events where task_id=$1 order by created_at", [id]))).rows.map((r) => r.kind);
  assert.deepEqual(kinds, ["edit", "progress", "discard", "restore"]);
});

test("both members edit and trash finances; fixed movements create each date once, catch up, pause and stop", async () => {
  // A's expense is corrected and trashed by B; other kinds stay author-only.
  const exp = (await as(a, () => db.query("select public.save_entry($1) id", [JSON.stringify({ kind: "transaction", title: "Mercado", amount: 120, occurred_on: "2026-11-10", details: { direction: "expense", category: "Comida" } })]))).rows[0].id;
  await as(b, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "transaction", title: "Mercado", amount: 135.5, occurred_on: "2026-11-10", details: { direction: "expense", category: "Comida" } }), exp]));
  let e = (await db.query("select amount::float a,owner_id,details from public.entries where id=$1", [exp])).rows[0];
  assert.deepEqual([e.a, e.owner_id, e.details.edited_by], [135.5, a, b]);
  await assert.rejects(() => as(b, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "budget", title: "x", amount: 1, details: {} }), exp])), /tipo/);
  await as(b, () => db.query("select public.trash_item('entries',$1)", [exp]));
  const diary = (await as(a, () => db.query("select public.save_entry($1,'Hoy') id", [JSON.stringify({ kind: "journal", title: "Mi nota" })]))).rows[0].id;
  await assert.rejects(() => as(b, () => db.query("select public.save_entry($1,'cambio',$2)", [JSON.stringify({ kind: "journal", title: "Otra" }), diary])), /No puedes editar/);
  await assert.rejects(() => as(b, () => db.query("select public.trash_item('entries',$1)", [diary])), /Sin acceso/);
  // A monthly rent that started three months ago fills in its past dates, once.
  const today = (await db.query("select min((now() at time zone coalesce(p.timezone,'America/Lima'))::date) d from public.space_members m join public.profiles p on p.id=m.user_id")).rows[0].d;
  const start = new Date(today); start.setUTCMonth(start.getUTCMonth() - 3);
  const rule = (await as(a, () => db.query("select public.save_recurring(null,$1) id", [JSON.stringify({ title: "Alquiler", amount: 900, direction: "expense", category: "Hogar", frequency: "monthly", start_on: start.toISOString().slice(0, 10) })]))).rows[0].id;
  const made = async () => (await db.query("select occurred_on::text d,amount::float a,details->>'direction' dir from public.entries where details->>'recurring_id'=$1 order by occurred_on", [rule])).rows;
  assert.equal((await made()).length, 4);
  assert.ok((await made()).every((m) => m.a === 900 && m.dir === "expense"));
  await db.query("select public.generate_recurring()");
  assert.equal((await made()).length, 4);
  // B raises the amount: only future movements change. Pausing and resuming skips the gap.
  await as(b, () => db.query("select public.save_recurring($1,$2)", [rule, JSON.stringify({ title: "Alquiler", amount: 950, category: "Hogar", active: false })]));
  assert.ok((await made()).every((m) => m.a === 900));
  await db.query("update public.finance_recurring set next_on=next_on-interval '2 months' where id=$1", [rule]);
  await as(a, () => db.query("select public.save_recurring($1,$2)", [rule, JSON.stringify({ title: "Alquiler", amount: 950, category: "Hogar", active: true })]));
  assert.equal((await made()).length, 4);
  const r = (await db.query("select next_on>$2::date future from public.finance_recurring where id=$1", [rule, today])).rows[0];
  assert.ok(r.future);
  // Validation, outsiders, and stopping a rule keeps what it created.
  await assert.rejects(() => as(a, () => db.query("select public.save_recurring(null,$1)", [JSON.stringify({ title: "Sueldo", amount: 0, direction: "income", frequency: "monthly", start_on: today })])), /importe/);
  await assert.rejects(() => as(c, () => db.query("select public.save_recurring(null,$1)", [JSON.stringify({ title: "x", amount: 1, direction: "income", frequency: "monthly", start_on: today })])), /Sin acceso/);
  await assert.rejects(() => as(a, () => db.query("insert into public.finance_recurring(space_id,title,amount,direction,frequency,start_on,next_on) values($1,'x',1,'income','monthly',now(),now())", [sid])), /permission denied/);
  // Every field can be edited: fixing past movements is opt-in, and a new day/frequency
  // continues after the last registered movement without duplicating it.
  await as(b, () => db.query("select public.save_recurring($1,$2)", [rule, JSON.stringify({ title: "Alquiler depa", amount: 1000, category: "Hogar", direction: "expense", apply_past: true })]));
  assert.ok((await made()).every((m) => m.a === 1000));
  const last = (await made()).at(-1).d;
  const newStart = new Date(start); newStart.setUTCDate(newStart.getUTCDate() + 4);
  await as(a, () => db.query("select public.save_recurring($1,$2)", [rule, JSON.stringify({ title: "Alquiler depa", amount: 1000, category: "Hogar", frequency: "monthly", start_on: newStart.toISOString().slice(0, 10) })]));
  const anchored = (await db.query("select next_on::text n,start_on::text s from public.finance_recurring where id=$1", [rule])).rows[0];
  assert.equal(anchored.s, newStart.toISOString().slice(0, 10));
  assert.ok(anchored.n > last);
  assert.equal(new Set((await made()).map((m) => m.d)).size, (await made()).length);
  await as(b, () => db.query("select public.delete_recurring($1)", [rule]));
  assert.ok((await made()).length >= 4);
  await assert.rejects(() => as(a, () => db.query("select public.generate_recurring()")), /permission denied/);
});

test("each movement says whose it is, fixed ones carry it, and savings feed shared or personal goals", async () => {
  const goal = (await as(b, () => db.query("select public.save_savings_goal(null,$1) id", [JSON.stringify({ title: "Viaje a Cusco", target: 3000, target_on: "2027-07-01", person: "" })]))).rows[0].id;
  const g = (await as(a, () => db.query("select title,target::float t,person from public.savings_goals where id=$1", [goal]))).rows[0];
  assert.deepEqual([g.title, g.t, g.person], ["Viaje a Cusco", 3000, null]);
  await as(a, () => db.query("select public.save_savings_goal($1,$2)", [goal, JSON.stringify({ title: "Viaje a Cusco", target: 3500, person: a })]));
  assert.equal((await db.query("select person from public.savings_goals where id=$1", [goal])).rows[0].person, a);
  // A one-off saving by B into the goal; invalid people, goals for non-savings, foreign goals fail.
  const save = (d) => as(a, () => db.query("select public.save_entry($1) id", [JSON.stringify({ kind: "transaction", title: "Ahorro", amount: 200, occurred_on: "2026-11-11", details: d })]));
  const id = (await save({ direction: "saving", person: b, goal_id: goal })).rows[0].id;
  assert.deepEqual((await db.query("select details->>'person' p,details->>'goal_id' g from public.entries where id=$1", [id])).rows[0], { p: b, g: goal });
  await assert.rejects(() => save({ direction: "expense", person: c }), /persona/);
  await assert.rejects(() => save({ direction: "expense", person: a, goal_id: goal }), /ahorro/);
  await assert.rejects(() => save({ direction: "saving", goal_id: "12345678-1234-4234-8234-123456789abc" }), /Meta/);
  // A fixed salary belongs to whoever it is set for; a fixed saving feeds the goal from the first movement.
  const today = (await db.query("select min((now() at time zone coalesce(p.timezone,'America/Lima'))::date)::text d from public.space_members m join public.profiles p on p.id=m.user_id")).rows[0].d;
  const salary = (await as(a, () => db.query("select public.save_recurring(null,$1) id", [JSON.stringify({ title: "Sueldo Glenny", amount: 2500, direction: "income", frequency: "monthly", start_on: today, person: b })]))).rows[0].id;
  const fixedSaving = (await as(b, () => db.query("select public.save_recurring(null,$1) id", [JSON.stringify({ title: "Para Cusco", amount: 300, direction: "saving", frequency: "monthly", start_on: today, person: "", goal_id: goal })]))).rows[0].id;
  const made = async (rule) => (await db.query("select details from public.entries where details->>'recurring_id'=$1", [rule])).rows.map((r) => r.details);
  assert.equal((await made(salary))[0].person, b);
  assert.deepEqual([(await made(fixedSaving))[0].person, (await made(fixedSaving))[0].goal_id], ["", goal]);
  // Pausing keeps person and goal; switching the rule to an expense drops the goal (also from the past ones).
  await as(a, () => db.query("select public.save_recurring($1,$2)", [fixedSaving, JSON.stringify({ title: "Para Cusco", amount: 300, active: false })]));
  assert.deepEqual((await db.query("select person,goal_id from public.finance_recurring where id=$1", [fixedSaving])).rows[0], { person: null, goal_id: goal });
  await as(a, () => db.query("select public.save_recurring($1,$2)", [fixedSaving, JSON.stringify({ title: "Para Cusco", amount: 300, direction: "expense", active: false, apply_past: true })]));
  assert.equal((await made(fixedSaving))[0].goal_id, undefined);
  // Removing the goal keeps the savings and unlinks them.
  await as(b, () => db.query("select public.delete_savings_goal($1)", [goal]));
  assert.equal((await db.query("select details->>'goal_id' g,amount::float a from public.entries where id=$1", [id])).rows[0].g, null);
  await assert.rejects(() => as(c, () => db.query("select public.save_savings_goal(null,$1)", [JSON.stringify({ title: "x", target: 1 })])), /Sin acceso/);
  await assert.rejects(() => as(a, () => db.query("insert into public.savings_goals(space_id,title,target) values($1,'x',1)", [sid])), /permission denied/);
});

test("a lost Google permission alerts its owner once a day; outages do not; date ideas are editable by both", async () => {
  const alerts = async (uid) => (await db.query("select title,path from public.notifications where kind='connection_error' and recipient_id=$1", [uid])).rows;
  await db.query("insert into private.google_connections(user_id,encrypted_refresh_token,calendar_id) values($1,'enc','primary') on conflict(user_id) do update set last_error=null", [b]);
  await db.query("update private.google_connections set last_error='Google Calendar no respondió. Puedes volver a intentar.' where user_id=$1", [b]);
  assert.equal((await alerts(b)).length, 0);
  await db.query("update private.google_connections set last_error='Reconecta Google Calendar para renovar el permiso.' where user_id=$1", [b]);
  await db.query("update private.google_connections set last_error=null where user_id=$1", [b]);
  await db.query("update private.google_connections set last_error='El permiso de Google caducó. Reconecta tu cuenta.' where user_id=$1", [b]);
  const cal = await alerts(b);
  assert.equal(cal.length, 1);
  assert.match(cal[0].title, /Calendar/);
  assert.equal(cal[0].path, "/ajustes/conexiones");
  await db.query("select public.gmail_service('connect',$1,$2)", [b, { email: "b@example.test", token: "enc-b" }]);
  await db.query("select public.gmail_service('error',$1,$2)", [b, { message: "Reconecta Gmail para renovar el permiso." }]);
  assert.ok((await alerts(b)).some((n) => /Gmail/.test(n.title)));
  // The seeded ideas belong to one member; the other can now edit and trash them.
  const idea = (await db.query("select id,owner_id from public.entries where kind='date' and deleted_at is null and owner_id=$1 limit 1", [a])).rows[0]
    ?? (await db.query("select id,owner_id from public.entries where kind='date' and deleted_at is null limit 1")).rows[0];
  const other = idea.owner_id === a ? b : a;
  await as(other, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "date", title: "Picnic en el parque", details: { category: "Aire libre" } }), idea.id]));
  const e = (await db.query("select title,owner_id,details->>'edited_by' ed from public.entries where id=$1", [idea.id])).rows[0];
  assert.deepEqual([e.title, e.owner_id, e.ed], ["Picnic en el parque", idea.owner_id, other]);
  await as(other, () => db.query("select public.trash_item('entries',$1)", [idea.id]));
  assert.ok((await db.query("select deleted_at from public.entries where id=$1", [idea.id])).rows[0].deleted_at);
});

test("either member can start or finish a shared movie/series, but only its creator can edit its details", async () => {
  const id = (await as(a, () => db.query("select public.save_entry($1) id", [JSON.stringify({ kind: "watch", title: "Una película", details: { format: "movie" } })]))).rows[0].id;
  await as(b, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "watch", title: "Una película", status: "progress" }), id]));
  assert.equal((await db.query("select status from public.entries where id=$1", [id])).rows[0].status, "progress");
  await as(b, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "watch", title: "Una película", status: "done" }), id]));
  assert.equal((await db.query("select status from public.entries where id=$1", [id])).rows[0].status, "done");
  await as(b, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "watch", title: "Cambiar título", status: "progress" }), id]));
  assert.equal((await db.query("select title from public.entries where id=$1", [id])).rows[0].title, "Una película");
  await assert.rejects(() => as(c, () => db.query("select public.save_entry($1,'',$2)", [JSON.stringify({ kind: "watch", title: "Una película", status: "done" }), id])), /No puedes editar/);
});

test("our questions are edited and trashed by either member, bank questions are only hidden, and shared trash is visible to both", async () => {
  const own = (await as(a, () => db.query("insert into public.questions(space_id,created_by,category,title,depth) values($1,$2,'Nosotros','¿Qué canción nos define?',1) returning id", [sid, a]))).rows[0].id;
  await as(b, () => db.query("select public.edit_question($1,'¿Qué canción nos define hoy?','Música',2)", [own]));
  assert.deepEqual((await db.query("select title,category,depth from public.questions where id=$1", [own])).rows[0], { title: "¿Qué canción nos define hoy?", category: "Música", depth: 2 });
  await assert.rejects(() => as(b, () => db.query("select public.edit_question($1,'no','Música',2)", [own])), /entre 3 y 240/);
  await as(b, () => db.query("select public.trash_item('questions',$1)", [own]));
  assert.ok((await db.query("select deleted_at from public.questions where id=$1", [own])).rows[0].deleted_at);
  await as(a, () => db.query("select public.trash_item('questions',$1,true)", [own]));
  assert.equal((await db.query("select deleted_at from public.questions where id=$1", [own])).rows[0].deleted_at, null);
  // A bank question cannot be edited; hiding it is per space and reversible, and the row stays.
  const bank = (await db.query("select id from public.questions where space_id is null limit 1")).rows[0].id;
  await assert.rejects(() => as(a, () => db.query("select public.edit_question($1,'Otra cosa','Nosotros',1)", [bank])), /banco/);
  await as(a, () => db.query("select public.trash_item('questions',$1)", [bank]));
  assert.equal((await as(b, () => db.query("select count(*)::int n from public.question_hidden where question_id=$1", [bank]))).rows[0].n, 1);
  await as(b, () => db.query("select public.trash_item('questions',$1,true)", [bank]));
  assert.equal((await db.query("select count(*)::int n from public.question_hidden where question_id=$1", [bank])).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from public.questions where id=$1", [bank])).rows[0].n, 1);
  await assert.rejects(() => as(c, () => db.query("select public.trash_item('questions',$1)", [own])), /Sin acceso/);
  // A shared entry trashed by one member is visible to the other in the trash and restorable by them.
  const exp = (await as(a, () => db.query("select public.save_entry($1) id", [JSON.stringify({ kind: "transaction", title: "Taxi", amount: 20, details: { direction: "expense" } })]))).rows[0].id;
  await as(a, () => db.query("select public.trash_item('entries',$1)", [exp]));
  assert.equal((await as(b, () => db.query("select count(*)::int n from public.entries where id=$1 and deleted_at is not null", [exp]))).rows[0].n, 1);
  await as(b, () => db.query("select public.trash_item('entries',$1,true)", [exp]));
  // Personal trashed content stays hidden from the partner.
  const note = (await as(a, () => db.query("select public.save_entry($1,'texto') id", [JSON.stringify({ kind: "journal", title: "Borrador" })]))).rows[0].id;
  await as(a, () => db.query("select public.trash_item('entries',$1)", [note]));
  assert.equal((await as(b, () => db.query("select count(*)::int n from public.entries where id=$1", [note]))).rows[0].n, 0);
});
