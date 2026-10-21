const labels = {
  FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACT: "Contract", INTERNSHIP: "Internship",
  YEARS_1_3: "1-3 years", YEARS_3_5: "3-5 years", YEARS_5_7: "5-7 years",
  HYBRID: "Hybrid", REMOTE: "Remote", ON_SITE: "On-site",
};

export const jobLabel = (value) => labels[value] ?? value;
