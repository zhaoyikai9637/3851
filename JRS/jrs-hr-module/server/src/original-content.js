import content from '../data/original-content.json' with { type: 'json' };
import { templateSchema } from './validation.js';

export async function installOriginalTemplates(db, models, hrUserId) {
  return db.transaction(async transaction => {
    const hr = await models.HrUser.findByPk(hrUserId, { transaction });
    if (!hr || hr.accountStatus !== 'ACTIVE') throw new Error('Choose an existing active HR profile.');
    let created = 0, retained = 0;
    for (const template of content.templates) {
      const fields = templateSchema.parse(template);
      const [, added] = await models.Template.findOrCreate({ where: { templateName: fields.templateName },
        defaults: { ...fields, createdBy: hrUserId, updatedBy: hrUserId, isActive: true }, transaction });
      if (added) created++; else retained++;
    }
    return { created, retained };
  });
}
