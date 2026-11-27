// About: who made the game and the credits for the models, behind an "About" button at the
// bottom of the settings (the pause menu, and the title screen's How to play box). Added after
// the migration. Like src/ui/savefile.js it handles clicks on its own button, before the game's
// own panel buttons see them, so the original click handling is untouched.
const link = (href, text) => '<a href="' + href + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">' + text + '</a>';

const ABOUT = '<div class="about" style="margin:10px auto 0;max-width:440px;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.25);font-size:14px;line-height:1.55;text-align:left">' +
  '<b>Stranded: 100 Days on Kestrel Island</b><br>' +
  'Made for Caspar.<br>' +
  'Built with ' + link('https://threejs.org', 'three.js') + '.<br>' +
  'Animals and Uncle Ray by ' + link('https://quaternius.com', 'Quaternius') + ' (CC0).<br>' +
  'Bears made from ' + link('https://poly.pizza/m/56ym_pyVnel', '“Black bear”') + ' by Poly by Google, licensed under ' +
  link('https://creativecommons.org/licenses/by/3.0/', 'CC BY 3.0') + '; rigged, animated and retextured for this game.' +
  '</div>';

document.addEventListener('click', e => {
  const el = e.target && e.target.closest && e.target.closest('[data-a="about"]');
  if (!el) return;
  e.stopPropagation();
  const open = el.nextElementSibling && el.nextElementSibling.classList.contains('about');
  if (open) el.nextElementSibling.remove(); else el.insertAdjacentHTML('afterend', ABOUT);
}, true);

export { ABOUT };
