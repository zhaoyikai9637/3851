import session from 'express-session';
export class DatabaseSessionStore extends session.Store {
  constructor(model) { super(); this.model = model; }
  get(sid, done) { this.model.findByPk(sid).then(row => done(null, row && new Date(row.expires) > new Date() ? JSON.parse(row.data) : null)).catch(done); }
  set(sid, value, done = () => {}) { this.model.upsert({ sid, data: JSON.stringify(value), expires: value.cookie.expires || new Date(Date.now()+8*3600000) }).then(() => done()).catch(done); }
  destroy(sid, done = () => {}) { this.model.destroy({ where: { sid } }).then(() => done()).catch(done); }
  touch(sid, value, done = () => {}) { this.model.update({ expires: value.cookie.expires || new Date(Date.now()+8*3600000) }, { where: { sid } }).then(() => done()).catch(done); }
}
