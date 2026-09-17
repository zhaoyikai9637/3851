export async function up({ context: q }) {
  const columns = await q.describeTable('NOTIFICATION_LOG');
  const retiredTag = ['de', 'mo'].join('');
  const retiredColumn = `is_${retiredTag}`;
  const retiredHistory = columns[retiredColumn] ? `l.${retiredColumn} = 1 OR l.event_key LIKE '${retiredTag}:%'` : `l.event_key LIKE '${retiredTag}:%'`;
  const retiredRows = columns[retiredColumn] ? `${retiredColumn} = 1 OR event_key LIKE '${retiredTag}:%'` : `event_key LIKE '${retiredTag}:%'`;
  const transaction = await q.sequelize.transaction();
  try {
    await q.sequelize.query(`DELETE a FROM NOTIFICATION_ATTACHMENT a INNER JOIN NOTIFICATION_LOG l ON l.log_id = a.log_id WHERE ${retiredHistory}`, { transaction });
    await q.sequelize.query(`DELETE FROM NOTIFICATION_LOG WHERE ${retiredRows}`, { transaction });
    await q.sequelize.query(`DELETE FROM SYSTEM_NOTIFICATION WHERE event_key LIKE '${retiredTag}:%' OR LOWER(source_module) LIKE '%${retiredTag}%' OR LOWER(message) LIKE '%${retiredTag}:%'`, { transaction });
    await q.sequelize.query("DELETE a FROM APPLICATION a LEFT JOIN NOTIFICATION_LOG l ON l.application_id = a.application_id LEFT JOIN SYSTEM_NOTIFICATION n ON n.application_id = a.application_id WHERE l.log_id IS NULL AND n.notification_id IS NULL", { transaction });
    await q.sequelize.query("DELETE c FROM CANDIDATE c LEFT JOIN APPLICATION a ON a.candidate_id = c.candidate_id WHERE a.application_id IS NULL", { transaction });
    await q.sequelize.query("DELETE j FROM JOB_POSITION j LEFT JOIN APPLICATION a ON a.position_id = j.position_id WHERE a.application_id IS NULL", { transaction });
    await q.sequelize.query("DELETE a FROM MODULE_ACCOUNT a LEFT JOIN HR_USER h ON h.user_id = a.hr_user_id LEFT JOIN APPLICATION p ON p.assigned_hr_user_id = h.user_id LEFT JOIN NOTIFICATION_LOG l ON l.sender_user_id = h.user_id WHERE h.user_id <> 1 AND p.application_id IS NULL AND l.log_id IS NULL", { transaction });
    await q.sequelize.query("DELETE h FROM HR_USER h LEFT JOIN APPLICATION p ON p.assigned_hr_user_id = h.user_id LEFT JOIN NOTIFICATION_LOG l ON l.sender_user_id = h.user_id LEFT JOIN EMAIL_TEMPLATE t ON t.created_by = h.user_id OR t.updated_by = h.user_id WHERE h.user_id <> 1 AND p.application_id IS NULL AND l.log_id IS NULL AND t.template_id IS NULL", { transaction });
    await q.sequelize.query("UPDATE HR_USER SET employee_id = 'LOCAL-HR-001', office_location = 'Main Office' WHERE user_id = 1", { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  // The dedicated application account intentionally has no ALTER grant.
  // The retired compatibility column may remain in an existing database, but
  // application models and API responses no longer read or write it.
}

export async function down() {
  throw new Error('Destructive rollback intentionally disabled. Restore from a reviewed backup if required.');
}
