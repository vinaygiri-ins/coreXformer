const SUPABASE_URL = "https://xqeqvetxezfrgwsxeyxi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Kv7Rl1vg3mjfv0UEQULWsA_wPmncHk-";

const SESSION_GROUPS = [
  {
    audience_type: "school",
    organization_name: "Smoke Test School · Pinecrest Academy",
    product_slug: "belong-connect",
    product_name: "Belong & Connect",
    session_title: "School Belonging Reflection Lab",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-03",
    participant_role: "student"
  },
  {
    audience_type: "college",
    organization_name: "Smoke Test College · Ridgeview University",
    product_slug: "student-leadership-in-action",
    product_name: "Student Leadership in Action",
    session_title: "Student Leadership Reflection Studio",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-05",
    participant_role: "student"
  },
  {
    audience_type: "corporate",
    organization_name: "Smoke Test Corporate · Northstar Technologies",
    product_slug: "responding-under-pressure",
    product_name: "Responding Under Pressure",
    session_title: "Pressure, Decisions, and Team Awareness",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-07",
    participant_role: "employee"
  },
  {
    audience_type: "teacher",
    organization_name: "Smoke Test Teachers · Horizon Faculty Collective",
    product_slug: "connection-before-instruction",
    product_name: "Connection Before Instruction",
    session_title: "Teacher Presence and Connection Workshop",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-09",
    participant_role: "teacher"
  },
  {
    audience_type: "community",
    organization_name: "Smoke Test Community · Riverbend Youth Forum",
    product_slug: "respect-in-difference",
    product_name: "Respect in Difference",
    session_title: "Community Dialogue and Respect Circle",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-11",
    participant_role: "leader"
  },
  {
    audience_type: "government",
    organization_name: "Smoke Test Government · District Learning Cell",
    product_slug: "team-up-solve",
    product_name: "Team Up & Solve",
    session_title: "Public Team Collaboration Workshop",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-12",
    participant_role: "manager"
  },
  {
    audience_type: "school",
    organization_name: "Smoke Test School · Greenfield Public School",
    product_slug: "courage-confidence-action",
    product_name: "Courage Confidence Action",
    session_title: "School Courage and Action Session",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-14",
    participant_role: "student"
  },
  {
    audience_type: "college",
    organization_name: "Smoke Test College · Summit Commerce Institute",
    product_slug: "reflection-as-practice",
    product_name: "Reflection as Practice",
    session_title: "College Reflection and Habit Design Session",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-16",
    participant_role: "student"
  },
  {
    audience_type: "corporate",
    organization_name: "Smoke Test Corporate · Forge Manufacturing Works",
    product_slug: "teacher-leadership-in-action",
    product_name: "Leadership in Action",
    session_title: "Manufacturing Leadership Alignment Intensive",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-18",
    participant_role: "manager"
  },
  {
    audience_type: "teacher",
    organization_name: "Smoke Test Teachers · Beacon Educator Network",
    product_slug: "preventing-burnout-rebuilding-energy",
    product_name: "Preventing Burnout, Rebuilding Energy",
    session_title: "Teacher Energy and Sustainability Reset",
    facilitator_name: "Lt. Commander Vinay Giri (Retd.)",
    session_date: "2026-06-20",
    participant_role: "teacher"
  }
];

const MOMENTS = [
  "I noticed how quickly the room changed once someone named what was actually happening.",
  "The strongest moment was realizing that hesitation often looks like disinterest from the outside.",
  "I stayed with the feeling that shared experience creates honesty faster than advice does.",
  "The activity made me see how small behaviors quietly shape trust in the whole group.",
  "What stayed most was the shift from performance to genuine participation."
];

const INSIGHTS = [
  "The session helped me connect my goals with the habits that either support or block them.",
  "I saw that teams become clearer when people reflect before defending their own position.",
  "It made visible how communication gaps are often behavioral rather than technical.",
  "I understood that people work better together when expectations are named early.",
  "It revealed that awareness has to come before accountability can feel fair."
];

const FACILITATOR_NOTES = [
  "The facilitator helped the room slow down, feel safe, and speak more honestly.",
  "The way the facilitator held silence made reflection feel real instead of forced.",
  "The facilitator kept the energy steady while still challenging us to name what mattered.",
  "The room felt more open because the facilitator balanced structure with warmth.",
  "The facilitator brought calm clarity when the discussion became scattered."
];

const TAKEAWAYS = [
  "I want to pause earlier, notice the room, and respond with more intention.",
  "I want to carry more openness into the way I communicate inside the group.",
  "I want to be more deliberate about behaviors that affect trust and follow-through.",
  "I want to name issues sooner instead of waiting for them to grow.",
  "I want to keep linking personal goals with group responsibility."
];

const IMPROVEMENTS = [
  "A few more minutes for smaller group sharing would help deepen the reflection.",
  "A short written prompt before the final discussion would make insights easier to capture.",
  "More time to compare perspectives across teams would strengthen the takeaway.",
  "A quick recap slide at the end would help people hold the key language.",
  "The session already worked well, but a slightly longer close would help the learning settle."
];

const ROLE_BY_AUDIENCE = {
  school: "student",
  college: "student",
  corporate: "employee",
  teacher: "teacher",
  community: "leader",
  government: "manager"
};

function buildRows() {
  return SESSION_GROUPS.flatMap((group, groupIndex) => (
    Array.from({ length: 5 }, (_value, responseIndex) => {
      const safeSpace = 3 + ((groupIndex + responseIndex + 1) % 3);
      const meaning = 4 + ((groupIndex + responseIndex) % 2);
      const overall = 4 + ((groupIndex + responseIndex + 1) % 2);
      const facilitator = 4 + ((groupIndex + responseIndex) % 2);
      const reflection = 3 + ((groupIndex + responseIndex + 2) % 3);
      const createdAt = buildCreatedAt(group.session_date, responseIndex);
      const participantNumber = groupIndex * 5 + responseIndex + 1;

      return {
        organization_name: group.organization_name,
        audience_type: group.audience_type,
        product_slug: group.product_slug,
        product_name: group.product_name,
        session_title: group.session_title,
        facilitator_name: group.facilitator_name,
        safe_space_rating: safeSpace,
        activity_meaning_rating: meaning,
        reflection_value_rating: reflection,
        lasting_moment: MOMENTS[(groupIndex + responseIndex) % MOMENTS.length],
        teamwork_insight: INSIGHTS[(groupIndex + responseIndex) % INSIGHTS.length],
        future_takeaway: TAKEAWAYS[(groupIndex + responseIndex) % TAKEAWAYS.length],
        share_publicly: responseIndex % 3 !== 0,
        display_name: `Smoke participant ${String(participantNumber).padStart(2, "0")}`,
        status: "hidden",
        created_at: createdAt,
        session_experience_rating: overall,
        facilitator_impact_rating: facilitator,
        participant_role: group.participant_role || ROLE_BY_AUDIENCE[group.audience_type] || "participant",
        facilitator_impact_note: FACILITATOR_NOTES[(groupIndex + responseIndex) % FACILITATOR_NOTES.length],
        improvement_note: IMPROVEMENTS[(groupIndex + responseIndex) % IMPROVEMENTS.length],
        session_date: group.session_date
      };
    })
  ));
}

function buildCreatedAt(sessionDate, responseIndex) {
  const baseDate = new Date(`${sessionDate}T09:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + responseIndex);
  baseDate.setUTCHours(9 + responseIndex, 15 * responseIndex, 0, 0);
  return baseDate.toISOString();
}

async function seedFeedbackRows() {
  const rows = buildRows();
  const attempts = [
    {
      label: "full feedback schema",
      rows
    },
    {
      label: "without facilitator free-text notes",
      rows: omitFields(rows, ["facilitator_impact_note", "improvement_note"])
    },
    {
      label: "without facilitator notes or participant role",
      rows: omitFields(rows, ["facilitator_impact_note", "improvement_note", "participant_role"])
    },
    {
      label: "legacy feedback schema",
      rows: omitFields(rows, [
        "session_experience_rating",
        "facilitator_impact_rating",
        "participant_role",
        "facilitator_impact_note",
        "improvement_note",
        "session_date"
      ])
    }
  ];

  let inserted = null;
  let usedSchema = "";
  let lastError = "";

  for (const attempt of attempts) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/session_feedback`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(attempt.rows)
    });

    if (response.ok) {
      inserted = await response.json();
      usedSchema = attempt.label;
      break;
    }

    lastError = `Seed request failed with ${response.status}: ${await response.text()}`;
  }

  if (!inserted) {
    throw new Error(lastError || "Seed request failed.");
  }

  const summary = SESSION_GROUPS.map((group) => ({
    session_title: group.session_title,
    organization_name: group.organization_name,
    responses: 5
  }));

  console.log(JSON.stringify({
    inserted: Array.isArray(inserted) ? inserted.length : 0,
    schemaMode: usedSchema,
    hidden: true,
    groups: summary
  }, null, 2));
}

function omitFields(rows, fields) {
  return rows.map((row) => {
    const clone = { ...row };

    fields.forEach((field) => {
      delete clone[field];
    });

    return clone;
  });
}

seedFeedbackRows().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
