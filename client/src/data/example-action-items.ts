/**
 * Example action items from 8 medical specialties.
 * Content sourced from server/src/resources/action_item/*.md files.
 */

export interface ExampleActionItem {
  id: string;
  specialty: string;
  contentArea: string;
  icon: string;
  difficulty: "Basic" | "Moderate" | "Comprehensive";
  preview: string;
  fullText: string;
}

export const EXAMPLE_ACTION_ITEMS: ExampleActionItem[] = [
  {
    id: "surgery",
    specialty: "Surgery",
    contentArea: "Operative Autonomy",
    icon: "\u{1FA7B}",
    difficulty: "Comprehensive",
    preview:
      "Declining operative autonomy and chief-level cases demand a structured progressive-responsibility framework with Zwisch scale integration.",
    fullText: `# Surgery \u2014 Action Item

Major Content Areas: Curriculum
Specific Content Areas: Operative autonomy and progressive responsibility; preparedness for independent practice; senior resident chief experience

Background:
Over the past three academic years, multiple data sources have shown that our residents, particularly graduating chiefs, perceive suboptimal operative autonomy and have variable opportunities for progressive responsibility. The ACGME Resident Survey item on adequate operative experience/autonomy has declined from 72% positive in 2021-2022 to 66% in 2023-2024, now roughly 18 points below the national mean for general surgery (84%). Our internal annual survey shows a parallel trend: the proportion of PGY3-4 residents who agree they have appropriate graded responsibility in the OR dropped from 74% to 65% over three years, and for PGY5s the decline was steeper, from 70% to 58%.

ABSITE operative management subscores for PGY4-5 residents have slipped from the 58th to the 52nd percentile over the same period. While overall ABSITE performance remains acceptable (58th-62nd percentile), the downward trend in operative management domains suggests fewer meaningful intraoperative decision-making opportunities. Case log data tells a similar story: total major cases remain stable and above ABS minimums (950-980 median), but median chief-level cases have drifted from 160 to 148.

Objective:
By June 30, 2027, design and implement a structured progressive-responsibility and operative-autonomy curriculum that improves ACGME survey positive responses from 66% to 80%+, increases chief-level index cases, and raises ABSITE operative management subscores from the 52nd to 60th percentile.

Action Steps:
1. Finalize and approve the progressive-responsibility framework by presenting the draft index procedure and PGY-level expectations to the Education Committee and Department Executive Committee. PD and APD for Curriculum lead; December 2025 through January 2026.
2. Launch faculty development on graded autonomy through at least two live workshops plus a recorded module. PD and Site Directors lead; February-April 2026.
3. Pilot pre-op autonomy contracts and post-op debrief forms for five high-yield index procedures. APD for Clinical Operations and Chief Residents lead; pilot April-June 2026, full rollout July 2026.
4. Integrate autonomy content into conferences and simulation with quarterly operative decision-making case conferences. Simulation Director and APD for Curriculum lead; by July 2026.
5. Align rotation structure and individualized goals by reviewing PGY3-5 block assignments. APD for Clinical Operations and Site Directors lead; rotation planning October-December 2026.`,
  },
  {
    id: "emergency_medicine",
    specialty: "Emergency Medicine",
    contentArea: "Direct Observation & Entrustment",
    icon: "\u{1F6A8}",
    difficulty: "Comprehensive",
    preview:
      "Faculty supervision scores dropped 10 points below EM national mean, with only 29% of residents receiving structured direct observations per block.",
    fullText: `# Emergency Medicine \u2014 Action Item

Major Content Areas: Supervision, Clinical Experience and Education, Patient Safety/Quality Improvement
Specific Content Areas: Direct Observation of Clinical Care, Feedback and Supervision in the ED, Entrustment and Progressive Autonomy

Background:
Over the past three academic years, multiple data sources have highlighted variability and gaps in direct observation, feedback, and entrustment practices in our Emergency Medicine residency. On the ACGME Resident Survey, the proportion of residents responding "always" or "very often" to "faculty provide appropriate supervision" dropped from 82% in 2022 to 74% in 2024, now 10 points below the national EM mean of 84%. Satisfaction with feedback that helps improve clinical skills fell from 76% to 68% over the same period.

Our internal program survey found that only 41% of interns, 29% of PGY-2s, and 18% of PGY-3s reported receiving at least one structured documented direct observation per ED block. Just 52% of residents agreed that levels of supervision are clearly communicated and aligned with their competence.

Objective:
By June 30, 2026, implement a standardized competency-based direct observation and entrustment framework that increases documented structured direct observations per block from 29% to 80%+, improves ACGME supervision scores from 74% to 85%+, and reduces CCC flags for insufficient observation data from 22% to 5% or less.

Action Steps:
1. Finalize PGY-specific entrustable activities and supervision levels with ED-relevant EPAs. PD and APD lead; by August 2025.
2. Develop standardized direct observation tools in MedHub with behaviorally anchored checklists. APD for Assessment lead; by October 2025.
3. Set minimum observation requirements of two documented observations per resident per ED block. PD and Chief Residents lead; by November 2025.
4. Conduct faculty development workshops on observation, feedback, and entrustment. PD lead; by December 2025.
5. Integrate observation data into CCC and milestone reviews. CCC Chair lead; by January 2026.
6. Monitor impact on supervision-sensitive patient safety events. PD lead; first review by March 2026.
7. Review monthly observation completion reports and share dashboards with faculty. PD and Chief Residents lead; ongoing.`,
  },
  {
    id: "pediatrics",
    specialty: "Pediatrics",
    contentArea: "Scholarly Activity",
    icon: "\u{1F9D2}",
    difficulty: "Comprehensive",
    preview:
      "Only 17% of residents present scholarly work at graduation, roughly half the national benchmark. A structured longitudinal scholarly activity program is needed.",
    fullText: `# Pediatrics \u2014 Action Item

Major Content Areas: Scholarly Activity
Specific Content Areas: Resident scholarly productivity; mentorship and infrastructure for research/quality improvement

Background:
Over the past three academic years our pediatric residency has shown plateauing resident scholarly output. Abstract presentations at national or regional meetings have held steady at 6-7 per year, with only 14-17% of residents (5-6 out of 36) presenting any scholarly work. Manuscript output has been similarly flat, averaging one resident first-author publication and 2-3 co-authored papers per year. Only 4 of 36 residents (11%) graduated with a first-author publication over those three years, well below our institutional goal of 25% or more.

ACGME Resident Survey scores for "opportunities for scholarly activity" declined from 3.7 to 3.6 and now sit 0.5 points below the specialty mean of 4.1, with compliance at 69%. Agreement that residents have access to adequate scholarly mentorship dropped from 63% to 58%.

Objective:
By AY 2026-2027, implement a structured longitudinal scholarly activity program that increases residents with an approved project from 42% to 80%+, graduates with scholarly product from 17% to 35%+, mentorship satisfaction from 58% to 80%+, and ACGME survey score from 3.6 to 4.0+.

Action Steps:
1. Communicate new scholarly activity expectations at intern orientation and department meetings. PD and APD for Scholarship lead; June-July 2025.
2. Conduct annual fall matching event for faculty projects and resident interest forms. APD for Scholarship lead; starting October 2025.
3. Launch longitudinal curriculum through Academic Half Day with 3-4 sessions per PGY level. APD for Scholarship lead; January-June 2026.
4. Build protected scholarly time into resident schedules for AY 2026-2027. PD and Chief Residents lead; schedule build January-April 2026.
5. Establish monthly scholarship work-in-progress sessions. APD for Scholarship lead; launch March 2026.
6. Share abstract deadlines and allocate micro-grants for resident travel. PD lead; by September 2025.
7. Review project registry trends at PEC twice yearly. PD and APD lead; semi-annually beginning June 2026.`,
  },
  {
    id: "internal_medicine",
    specialty: "Internal Medicine",
    contentArea: "Ambulatory Continuity Clinic",
    icon: "\u{1FA7A}",
    difficulty: "Basic",
    preview:
      "Residents report slow clinic sessions and inconsistent panel management. Template adjustments and scheduling improvements are planned.",
    fullText: `# Internal Medicine \u2014 Action Item

Major Content Areas: Clinical Experience
Specific Content Areas: Ambulatory Continuity Clinic \u2013 Patient Volume and Panel Management

Background:
Residents in the Internal Medicine continuity clinic have expressed that clinic sessions feel "slow" at times and that they do not always feel like they are managing a stable panel of patients. Some residents report seeing many one-time or urgent care visits rather than longitudinal follow-up, and clinic schedules are variable depending on the week and rotation. We have also had informal feedback from faculty that residents could benefit from more consistent exposure to chronic disease management. At present, we do not have a standardized expectation for the minimum number of patients per half-day clinic or a clear process to track resident panel size over time.

Objective:
1. Establish a general expectation for average resident patient volume per half-day clinic by end of academic year.
2. Increase resident perception of adequate continuity clinic experience compared to the previous year.

Action Steps:
1. Review current resident clinic templates and identify sessions with low scheduled patient volume; consider modest template adjustments. Clinic Medical Director with Program Coordinator; December 2025.
2. Provide residents with a brief overview about continuity clinic expectations at noon conference. Associate Program Director(s) with Chief Resident(s); January 2026.
3. Ask scheduling staff to prioritize follow-up appointments with the same resident for chronic disease management patients. Clinic Medical Director; February 2026.
4. Check in with residents mid-year and make adjustments as needed. Associate Program Director(s); March\u2013April 2026.`,
  },
  {
    id: "family_medicine",
    specialty: "Family Medicine",
    contentArea: "Behavioral Health Didactics",
    icon: "\u{1F3E0}",
    difficulty: "Moderate",
    preview:
      "Residents feel unsure managing outpatient behavioral health conditions. A structured didactic series covering depression, anxiety, and ADHD is planned.",
    fullText: `# Family Medicine \u2014 Action Item

Major Content Areas: Clinical Experience and Education
Specific Content Areas: Didactic Curriculum \u2013 Outpatient Behavioral Health

Background:
Residents have expressed in informal discussions that they sometimes feel unsure about managing common behavioral health conditions in the outpatient continuity clinic (e.g., depression, anxiety, ADHD). The current didactic schedule includes some behavioral health topics, but they are spread out and not always aligned with clinic experiences. In the most recent APE discussion, faculty noted variable comfort among residents in initiating and adjusting psychotropic medications. There is not a clearly defined behavioral health series within our existing didactic structure, and we have had limited involvement from embedded behavioral health providers in resident teaching.

Objective:
By June 30, 2026, incorporate a more consistent outpatient behavioral health component into the residency didactic schedule so that residents have regular exposure to key topics and report improved comfort with outpatient behavioral health management.

Action Steps:
1. Add behavioral health sessions to the existing didactic calendar covering depression, anxiety, and ADHD management. Program Director + Program Coordinator(s); January\u2013March 2026.
2. Reach out to behavioral health clinician(s) and faculty about leading or participating in sessions. Associate Program Director(s); January\u2013April 2026.
3. Encourage residents to bring questions from recent clinic cases to sessions. Program Coordinator(s); Ongoing.
4. Review resident survey results and faculty feedback at the next APE meeting. Program Director; June\u2013July 2026.`,
  },
  {
    id: "anesthesiology",
    specialty: "Anesthesiology",
    contentArea: "Resident Wellness",
    icon: "\u{1F4A4}",
    difficulty: "Basic",
    preview:
      "The Wellness Committee met only once last year and lost momentum. The program plans to re-establish regular meetings for burnout prevention.",
    fullText: `# Anesthesiology \u2014 Action Item

Major Content Areas: Program Administration
Specific Content Areas: Resident Wellness / Well-Being

Background:
In last year's action plan we formed a Resident Wellness Committee to address burnout concerns raised in the annual survey. The committee was established but did not meet regularly and the initiative lost momentum. We plan to continue this effort in 2025-2026.

Objective:
Re-establish the Resident Wellness Committee and hold regular meetings to promote wellness among anesthesiology residents.

Action Steps:
1. Re-form the Wellness Committee with interested residents and faculty. Program Director; August 2025.
2. Resume holding committee meetings. Program Director; September 2025.`,
  },
  {
    id: "obstetrics_gynecology",
    specialty: "OB/GYN",
    contentArea: "Simulation Training",
    icon: "\u{1F476}",
    difficulty: "Basic",
    preview:
      "Only 2 simulation sessions were held last year with 60% attendance. The program needs to reach 4 quarterly sessions with 80% attendance.",
    fullText: `# Obstetrics and Gynecology \u2014 Action Item

Major Content Areas: Curriculum
Specific Content Areas: Simulation

Background:
Per ACGME program requirements, OB/GYN residency programs must provide simulation-based training opportunities. Our simulation center has availability on select dates during the 2025-2026 academic year. The program coordinator has been asked to schedule sessions so that we are in compliance with this requirement.

Objective:
Schedule and track quarterly simulation sessions for OB/GYN residents to ensure sessions are documented and attendance is recorded in MedHub.

Action Steps:
1. Reserve simulation center rooms for four quarterly sessions. Program Coordinator; August 2025.
2. Send calendar invitations to all residents with room and time details. Program Coordinator; Two weeks before each session.
3. Enter each session into MedHub as a conference event and enable attendance tracking. Program Coordinator; August 2025.`,
  },
  {
    id: "psychiatry",
    specialty: "Psychiatry",
    contentArea: "Didactic Curriculum",
    icon: "\u{1F9E0}",
    difficulty: "Moderate",
    preview:
      "Only 38% of residents are satisfied with didactic education, below the national mean. Topics feel repetitive and disconnected from clinical work.",
    fullText: `# Psychiatry \u2014 Action Item

Major Content Areas: Curriculum
Specific Content Areas: Didactics

Background:
On the 2024 ACGME Resident Survey, 38% of residents rated satisfaction with didactic education as "agree" or "strongly agree," which is below the national mean. Multiple residents commented that topics feel repetitive and disconnected from clinical work.

Objective:
Comprehensively revamp the psychiatry didactic curriculum to align with updated ACGME milestones, incorporate case-based and interactive formats, and improve overall resident satisfaction with didactic education.

Action Steps:
1. Review current didactic topics and identify areas for improvement. Program Director; Fall 2025.
2. Solicit faculty volunteers to help update content. Program Director; Ongoing.`,
  },
];
