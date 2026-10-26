import {validateAppearance} from '../public/appearance.mjs';
import {validateGoals} from './goals.mjs';
import {upgradeLayouts} from '../public/layouts.mjs';
import {recapDefaults} from '../public/recap-model.mjs';
import {validateRecap} from './recap.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { defaults } from '../public/model.mjs';
import {upgradeBonusSettings} from '../public/bonus-model.mjs';
export class Store {
  constructor(dir) {
    mkdirSync(dir,{recursive:true});
    this.db=new DatabaseSync(join(dir,'pawn.db'));
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }
  get(key) { const row=this.db.prepare('SELECT value FROM documents WHERE key=?').get(key); return row ? JSON.parse(row.value) : null; }
  set(key,value) { this.db.prepare('INSERT INTO documents(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value)); }
  state(username) {
    const saved=this.get('state'),initial={...defaults(),recap:recapDefaults()};if(username)initial.username=username;
    if(!saved)return initial;
    const state={...initial,...saved,...upgradeLayouts(upgradeBonusSettings(saved)),ticker:{...initial.ticker,...saved.ticker}};
    for(const [name,preset] of Object.entries(state.presets))state.presets[name]=upgradeLayouts(upgradeBonusSettings(preset));
    validateRecap(state.recap);validateGoals(state.goalTracker);validateAppearance(state.appearance);
    return state;
  }
  close() { this.db.close(); }
}
