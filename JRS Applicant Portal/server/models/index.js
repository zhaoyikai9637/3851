import { DataTypes } from "sequelize";

export function defineModels(sequelize) {
  const User = sequelize.define("User", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    fullName: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    role: { type: DataTypes.ENUM("applicant", "hr"), allowNull: false, defaultValue: "applicant" },
  });

  const ApplicantProfile = sequelize.define("ApplicantProfile", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    phone: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "" },
    location: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "" },
    availabilityStatus: { type: DataTypes.ENUM("AVAILABLE", "CLOSED"), allowNull: false, defaultValue: "AVAILABLE" },
    education: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    languages: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  });

  const Job = sequelize.define("Job", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(120), allowNull: false },
    department: { type: DataTypes.STRING(80), allowNull: false },
    location: { type: DataTypes.STRING(100), allowNull: false },
    workMode: { type: DataTypes.STRING(40), allowNull: false },
    employmentType: { type: DataTypes.STRING(40), allowNull: false },
    experienceLevel: { type: DataTypes.STRING(60), allowNull: false },
    salaryRange: { type: DataTypes.STRING(80), allowNull: false },
    summary: { type: DataTypes.STRING(500), allowNull: false },
    responsibilities: { type: DataTypes.JSON, allowNull: false },
    requirements: { type: DataTypes.JSON, allowNull: false },
    preferredQualifications: { type: DataTypes.JSON, allowNull: false },
    benefits: { type: DataTypes.JSON, allowNull: false },
    roleQuestions: { type: DataTypes.JSON, allowNull: false },
    closingDate: { type: DataTypes.DATEONLY, allowNull: false },
    isOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  });

  const Resume = sequelize.define("Resume", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    originalName: { type: DataTypes.STRING(180), allowNull: false },
    storedName: { type: DataTypes.STRING(220), allowNull: false },
    mimeType: { type: DataTypes.STRING(120), allowNull: false },
    size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  });

  const Application = sequelize.define("Application", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    location: { type: DataTypes.STRING(100), allowNull: false },
    coverLetter: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    experiences: { type: DataTypes.JSON, allowNull: false },
    roleAnswers: { type: DataTypes.JSON, allowNull: false },
    status: {
      type: DataTypes.ENUM("Submitted", "In Review", "Interview", "Decision", "Accepted", "Rejected", "Withdrawn"),
      allowNull: false,
      defaultValue: "Submitted",
    },
    statusMessage: { type: DataTypes.STRING(500), allowNull: false, defaultValue: "Your application has been received by the recruitment team." },
    submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  User.hasOne(ApplicantProfile, { as: "profile", foreignKey: { name: "userId", allowNull: false }, onDelete: "CASCADE" });
  ApplicantProfile.belongsTo(User, { as: "user", foreignKey: "userId" });
  User.hasMany(Resume, { as: "resumes", foreignKey: { name: "userId", allowNull: false }, onDelete: "CASCADE" });
  Resume.belongsTo(User, { as: "user", foreignKey: "userId" });
  User.hasMany(Application, { as: "applications", foreignKey: { name: "userId", allowNull: false }, onDelete: "CASCADE" });
  Application.belongsTo(User, { as: "applicant", foreignKey: "userId" });
  Job.hasMany(Application, { as: "applications", foreignKey: { name: "jobId", allowNull: false } });
  Application.belongsTo(Job, { as: "job", foreignKey: "jobId" });
  Resume.hasMany(Application, { as: "applications", foreignKey: { name: "resumeId", allowNull: false } });
  Application.belongsTo(Resume, { as: "resume", foreignKey: "resumeId" });

  return { User, ApplicantProfile, Job, Resume, Application };
}
