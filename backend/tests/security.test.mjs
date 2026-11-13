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
  await db.query(
    `insert into auth.users(id,email) values ($1,'jcusilaymeg@gmail.com'),($2,'032azq@gmail.com'),($3,'stranger@example.com')`,
    [a, b, c],
  );
});
after(() => db.close());
test('soft deletion hides shared content from the partner and restoration recovers it',async()=>{
 const id=(await as(a,()=>db.query('select public.save_entry($1,$2) as id',[JSON.stringify({kind:'journal',title:'Un recuerdo restaurable',visibility:'shared'}),'Nuestra historia']))).rows[0].id;
 await as(a,()=>db.query("select public.trash_item('entries',$1)",[id]));
 await as(b,async()=>{assert.equal((await db.query('select * from public.entries where id=$1',[id])).rows.length,0);assert.equal((await db.query('select * from public.entry_bodies where entry_id=$1',[id])).rows.length,0);});
 await as(a,()=>db.query("select public.trash_item('entries',$1,true)",[id]));
 await as(b,async()=>assert.equal((await db.query('select content from public.entry_bodies where entry_id=$1',[id])).rows[0].content,'Nuestra historia'));
});
test('scheduled reminders are deduplicated and private events notify only their owner',async()=>{
 const task=(await as(a,()=>db.query("insert into public.tasks(space_id,title) values($1,'Un reporte pendiente') returning id",[sid]))).rows[0];
 const progress=(await as(a,()=>db.query('select public.report_task_progress($1,50) as id',[task.id]))).rows[0];
 await db.query("update public.task_progress set created_at=now()-interval '74 hours' where id=$1",[progress.id]);
 const event=(await as(a,()=>db.query("insert into public.calendar_events(space_id,title,start_at,end_at) values($1,'Un evento privado',now()+interval '30 minutes',now()+interval '90 minutes') returning id",[sid]))).rows[0];
 await db.query('select public.enqueue_reminders()');await db.query('select public.enqueue_reminders()');
 const reminders=(await db.query("select * from public.notifications where dedupe_key like $1",['reminder:'+progress.id+':%'])).rows;
 assert.equal(reminders.length,2);assert(reminders.every(n=>n.recipient_id===b));
 const events=(await db.query("select * from public.notifications where dedupe_key like $1",['event-reminder:'+event.id+':%'])).rows;
 assert.equal(events.length,1);assert.equal(events[0].recipient_id,a);
});
test("shared mood exposes state but never the note; personal finances stay private", async () => {
  const mood = (
    await as(a, () =>
      db.query("select public.save_entry($1,$2) as id", [
        JSON.stringify({
          kind: "mood",
          title: "Me siento bien",
          visibility: "shared",
          details: { mood: "bien" },
        }),
        "Una nota privada",
      ]),
    )
  ).rows[0].id;
  await as(b, async () => {
    assert.equal(
      (await db.query("select id from public.entries where id=$1", [mood])).rows
        .length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from public.entry_bodies where entry_id=$1", [
          mood,
        ])
      ).rows.length,
      0,
    );
  });
  const tx = (
    await as(a, () =>
      db.query("select public.save_entry($1) as id", [
        JSON.stringify({
          kind: "transaction",
          title: "Mi ingreso",
          amount: 500,
          details: { direction: "income" },
        }),
      ]),
    )
  ).rows[0].id;
  await as(b, async () =>
    assert.equal(
      (await db.query("select * from public.entries where id=$1", [tx])).rows
        .length,
      0,
    ),
  );
  await as(a, async () =>
    assert.equal(
      (
        await db.query(
          "select content from public.entry_bodies where entry_id=$1",
          [mood],
        )
      ).rows[0].content,
      "Una nota privada",
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
      `insert into public.photos(id,space_id,title,storage_path,thumb_path,captured_at,captured_at_source,size_bytes,width,height) values($1,$2,'Privada',$3,$4,now(),'manual',1000,100,100)`,
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
      0,
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
test("private records stay private and capsules cannot be read or changed before opening", async () => {
  const create = async (data, body) =>
    as(a, () =>
      db.query("select public.save_entry($1,$2) as id", [
        JSON.stringify(data),
        body,
      ]),
    );
  const privateId = (
    await create({ kind: "journal", title: "Privado" }, "Mi nota privada")
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
      0,
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
    assert.equal((await db.query('select * from public.questions')).rows.length,0);
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
