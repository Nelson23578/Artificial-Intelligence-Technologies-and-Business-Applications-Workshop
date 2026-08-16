import './style.css';
import { renderHome } from './pages-home.js';
import { renderHandwriting } from './pages-handwriting.js';
import { renderImageRecognition } from './pages-image.js';
import { renderSentiment } from './pages-sentiment.js';

const app = document.querySelector('#app');

const routes = {
  home: renderHome,
  handwriting: renderHandwriting,
  image: renderImageRecognition,
  sentiment: renderSentiment,
};

function route() {
  const page = (location.hash.replace('#/', '') || 'home').split('?')[0];
  const renderer = routes[page] || renderHome;
  app.innerHTML = '';
  renderer(app);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', route);
route();
