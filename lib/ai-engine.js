'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let sb = null;
function ctx() {
  if (sb) return sb;
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'aibrain.js'), 'utf8');
  sb = { window: {}, navigator: { language: 'en-IN' }, TextEncoder, URL, URLSearchParams, console: { log() {}, error() {} } };
  vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'aibrain.js', timeout: 3000 });
  if (!sb.window.QRBrain) throw new Error('AI engine failed to load');
  return sb;
}
// every call has a time limit, so a pathological input can never freeze the server
function run(expr, input) {
  const c = ctx(); c.__in = input;
  const out = vm.runInContext(`JSON.stringify(${expr})`, c, { timeout: 1500 });
  return JSON.parse(out === undefined ? 'null' : out);
}
const B = 'window.QRBrain';

exports.detect = (text) => run(`(function(t){var d=${B}.detect(t);delete d.ent;return d})(__in)`, text);
exports.parse = (text) => run(`(function(t){var e=${B}.entities(t);delete e.rest;if(e.wifi)e.wifi.pass=e.wifi.pass?'••••':'';return e})(__in)`, text);
exports.understand = (text) => run(`(function(t){var r=${B}.understand(t,null);if(r.det)delete r.det.ent;return r})(__in)`, text);
exports.validate = (type, fields, mode, ecl) => run(`${B}.validate(__in.type,__in.fields,{mode:__in.mode,ecl:__in.ecl})`, { type, fields, mode, ecl });
exports.build = (type, fields, mode) => run(`${B}.build(__in.type,__in.fields,__in.mode)`, { type, fields, mode });
exports.recommend = (type, fields, context) => run(`${B}.recommend(__in.type,__in.fields,__in.ctx)`, { type, fields, ctx: context });
exports.design = (text, opts) => run(`${B}.designFor(__in.text,__in.opts)`, { text, opts });
exports.themes = () => run(`${B}.themeList()`, null);
exports.hasType = (t) => run(`!!${B}.TYPES[__in]`, String(t));
exports.types = () => run(`Object.keys(${B}.TYPES).map(function(k){var t=${B}.TYPES[k];return{type:k,label:t.label,icon:t.icon,dynamic:t.dyn,fields:t.fields}})`, null);