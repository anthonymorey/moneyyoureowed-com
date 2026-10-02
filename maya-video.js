// Click-to-load YouTube card for the matching Maya video. Nothing is fetched from YouTube until the visitor clicks.
(function () {
  var el = document.querySelector('.maya-video[data-yt]');
  if (!el) return;
  var id = el.dataset.yt, title = el.dataset.title || 'Watch Maya explain this';
  var css = document.createElement('style');
  css.textContent = '.maya-video{margin:1.75rem 0 1rem;text-align:left;max-width:44rem}.maya-video p{font-weight:700;color:#1B6B5F;margin:0 0 .5rem;font-size:1rem}' +
    '.maya-video a.mv-play{position:relative;display:block;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;cursor:pointer;background:#000;box-sizing:border-box}.maya-video a.mv-play:focus-visible{outline:3px solid #1B6B5F;outline-offset:3px}' +
    '.maya-video img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.maya-video span{position:absolute;inset:0;margin:auto;width:68px;height:48px;border-radius:12px;background:#c4302b;color:#fff;font-size:24px;line-height:48px;text-align:center}' +
    '.maya-video iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:10px;display:block}';
  document.head.appendChild(css);
  el.innerHTML = '<p>▶ ' + title + '</p><a class="mv-play" role="button" href="https://www.youtube.com/watch?v=' + id + '" aria-label="Play video: ' + title.replace(/"/g, '&quot;') + '">' +
    '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span>▶</span></a>';
  el.querySelector('a.mv-play').addEventListener('click', function (e) {
    e.preventDefault();
    this.outerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0" title="' + title.replace(/"/g, '&quot;') + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  });
})();
