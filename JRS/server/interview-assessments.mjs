import { httpError } from "./security.mjs";
import assessment from "../JRS HR/server/assessment.cjs";

export async function loadAssessments(connection, workspace) {
  const [rows] = await connection.query(
    "SELECT interview_id,criteria FROM JRS_INTERVIEW_ASSESSMENT",
  );
  const interviews = new Map(workspace.interviews.map((row) => [row.id, row]));
  for (const row of rows) {
    const interview = interviews.get(row.interview_id);
    if (interview?.feedback)
      interview.feedback.assessment =
        typeof row.criteria === "string" ? JSON.parse(row.criteria) : row.criteria;
  }
  return workspace;
}

export async function saveAssessments(connection, before, after) {
  const previous = new Map(before.interviews.map((row) => [row.id, row.feedback?.assessment]));
  for (const interview of after.interviews) {
    if (!Array.isArray(interview.feedback?.assessment)) continue;
    const criteria = JSON.stringify(
      assessment.parseAssessment(JSON.stringify(interview.feedback.assessment)),
    );
    const old = previous.get(interview.id);
    if (old !== undefined) {
      if (JSON.stringify(old) !== criteria)
        throw httpError(409, "Recorded assessment criteria cannot be rewritten.");
      continue;
    }
    await connection.execute(
      "INSERT INTO JRS_INTERVIEW_ASSESSMENT(interview_id,criteria) VALUES(?,?)",
      [interview.id, criteria],
    );
  }
}
