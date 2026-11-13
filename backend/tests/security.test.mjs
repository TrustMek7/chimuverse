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
