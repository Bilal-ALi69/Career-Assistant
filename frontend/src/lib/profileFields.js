/* ---------------------------------------------------------
   SHARED PROFILE FIELD GROUPS
   Used by both the signup survey (SignupSurvey.jsx) and the
   Skills & Traits tabs (App.jsx) so the two stay in sync.
   Add a field here once and it shows up in both places.
--------------------------------------------------------- */

export const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada",
  "Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia",
  "Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","East Timor","Ecuador","Egypt",
  "El Salvador","Equatorial Guinea","Eritrea","Estonia","Ethiopia","Fiji","Finland","France","Gabon","Gambia",
  "Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti",
  "Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar",
  "Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia",
  "Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal",
  "Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan",
  "Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar",
  "Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
  "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia",
  "Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden",
  "Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

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
      { key: "country", label: "Country", type: "select", options: COUNTRIES, defaultValue: "All" },
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
      { key: "qualifications", label: "Qualifications / Certifications", type: "textarea" },
      { key: "work_experience", label: "Work Experience", type: "textarea", placeholder: "Roles, internships, projects" },
      { key: "preferred_industries", label: "Preferred Industries", type: "text", placeholder: "e.g. Tech, Healthcare, Finance" },
      { key: "extracurriculars", label: "Extracurriculars / Volunteering", type: "textarea" },
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
      { key: "salary_expectations", label: "Salary Expectations", type: "text" },
      { key: "notice_period", label: "Notice Period", type: "text", optional: true },
    ],
  },
  {
    key: "personality",
    tab: "Personality",
    title: "Strengths & Personality",
    subtitle: "Help the AI understand how you work and think.",
    fields: [
      { key: "strengths", label: "Strengths", type: "textarea", placeholder: "e.g. Problem solving, Leadership", required: true },
      { key: "weaknesses", label: "Weaknesses", type: "textarea", placeholder: "e.g. Public speaking", required: true },
      { key: "interests", label: "Interests", type: "textarea", placeholder: "e.g. AI, Design, Startups", required: true },
      { key: "hobbies", label: "Hobbies", type: "text" },
      { key: "values", label: "Values That Matter Most to You", type: "text", placeholder: "e.g. Autonomy, Impact, Stability" },
    ],
  },
  {
    key: "goals",
    tab: "Goals",
    title: "Career Goals",
    subtitle: "Where you're trying to go.",
    fields: [
      { key: "career_goals", label: "Career Goals", type: "textarea", placeholder: "Where do you want to be in a few years?" },
      { key: "background_constraints", label: "Background / Constraints", type: "textarea", placeholder: "Anything limiting your options (location, visa, timing)?" },
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
