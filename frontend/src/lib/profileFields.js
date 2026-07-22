/* ---------------------------------------------------------
   SHARED PROFILE FIELD GROUPS
   Used by both the signup survey (SignupSurvey.jsx) and the
   Skills & Traits tabs (App.jsx) so the two stay in sync.
   Add a field here once and it shows up in both places.
--------------------------------------------------------- */

export const PROFILE_FIELD_GROUPS = [
  {
    key: "personal",
    tab: "Personal",
    title: "Personal Information",
    subtitle: "The basics — this stays the same over time.",
    fields: [
      { key: "full_name", label: "Full Name", type: "text", placeholder: "e.g. Ali Bashir" },
      { key: "date_of_birth", label: "Date of Birth", type: "date" },
      { key: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Non-binary", "Prefer not to say"] },
      { key: "phone_number", label: "Phone Number", type: "text", placeholder: "+92 300 1234567" },
      { key: "country", label: "Country", type: "text", placeholder: "e.g. Pakistan", defaultValue: "All" },
      { key: "location", label: "City / Location", type: "text", placeholder: "e.g. Lahore, Pakistan" },
      { key: "current_address", label: "Current Address", type: "text", optional: true },
      { key: "languages", label: "Languages Spoken", type: "text", placeholder: "e.g. English, Urdu", optional: true },
      { key: "linkedin_url", label: "LinkedIn Profile", type: "text", optional: true },
      { key: "portfolio_url", label: "Portfolio / Website", type: "text", optional: true },
    ],
  },
  {
    key: "professional",
    tab: "Professional",
    title: "Education & Experience",
    subtitle: "Your professional background so far.",
    fields: [
      { key: "education", label: "Education", type: "textarea", placeholder: "Degree, institution, years" },
      { key: "qualifications", label: "Qualifications / Certifications", type: "textarea", optional: true },
      { key: "work_experience", label: "Work Experience", type: "textarea", optional: true, placeholder: "Roles, internships, projects" },
      { key: "preferred_industries", label: "Preferred Industries", type: "text", optional: true, placeholder: "e.g. Tech, Healthcare, Finance" },
      { key: "extracurriculars", label: "Extracurriculars / Volunteering", type: "textarea", optional: true },
    ],
  },
  {
    key: "preferences",
    tab: "Preferences",
    title: "Work Preferences",
    subtitle: "How and where you want to work.",
    fields: [
      { key: "preferred_work_environments", label: "Preferred Work Environment", type: "select", options: ["Remote", "Hybrid", "On-site", "No preference"] },
      { key: "work_preference", label: "Employment Type", type: "select", options: ["Full-time", "Part-time", "Internship", "Freelance/Contract"] },
      { key: "weekly_availability", label: "Weekly Availability (hrs)", type: "text", placeholder: "e.g. 40" },
      { key: "willing_to_relocate", label: "Willing to Relocate?", type: "select", options: ["Yes", "No", "Depends on the offer"] },
      { key: "salary_expectations", label: "Salary Expectations", type: "text", optional: true },
      { key: "notice_period", label: "Notice Period", type: "text", optional: true },
    ],
  },
  {
    key: "personality",
    tab: "Personality",
    title: "Strengths & Personality",
    subtitle: "Help the AI understand how you work and think.",
    fields: [
      { key: "strengths", label: "Strengths", type: "textarea", placeholder: "e.g. Problem solving, Leadership" },
      { key: "weaknesses", label: "Weaknesses", type: "textarea", placeholder: "e.g. Public speaking" },
      { key: "interests", label: "Interests", type: "textarea", placeholder: "e.g. AI, Design, Startups" },
      { key: "hobbies", label: "Hobbies", type: "text", optional: true },
      { key: "values", label: "Values That Matter Most to You", type: "text", optional: true, placeholder: "e.g. Autonomy, Impact, Stability" },
    ],
  },
  {
    key: "goals",
    tab: "Goals",
    title: "Career Goals",
    subtitle: "Where you're trying to go.",
    fields: [
      { key: "career_goals", label: "Career Goals", type: "textarea", placeholder: "Where do you want to be in a few years?" },
      { key: "background_constraints", label: "Background / Constraints", type: "textarea", optional: true, placeholder: "Anything limiting your options (location, visa, timing)?" },
    ],
  },
  {
    key: "other",
    tab: "Other Info",
    title: "Other Info",
    subtitle: "Optional — only fill in what applies to you.",
    fields: [
      { key: "disabilities", label: "Disabilities", type: "text", optional: true, defaultValue: "None" },
      { key: "medical_conditions", label: "Medical Conditions", type: "text", optional: true, defaultValue: "None" },
      { key: "work_authorization", label: "Work Authorization Status", type: "text", optional: true },
    ],
  },
];

export function defaultProfileValues() {
  const initial = {};
  PROFILE_FIELD_GROUPS.forEach((g) => g.fields.forEach((f) => {
    if (f.defaultValue) initial[f.key] = f.defaultValue;
  }));
  return initial;
}
