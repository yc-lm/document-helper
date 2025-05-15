import audio from './audio.js';
import paragraph from './paragraph.js';
import summary from './summary.js';
export default {
  audio:audio?.stamp_sents || [],
  paragraph: paragraph.answer,
  summary: summary.answer,
};
