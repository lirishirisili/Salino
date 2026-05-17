/**
 * Screenshot viewport: horizontal scroll on the viewport;
 * vertical wheel events pass through to the page.
 */
(function () {
  var viewport = document.querySelector('.screens-row-viewport');
  if (!viewport) return;

  // Center scroll on the hero (middle) image
  var hero = viewport.querySelector('.screen-shot--hero');
  if (hero) {
    var scrollTo = hero.offsetLeft - (viewport.offsetWidth - hero.offsetWidth) / 2;
    viewport.scrollLeft = scrollTo;
  }

  viewport.addEventListener(
    'wheel',
    function (e) {
      var absX = Math.abs(e.deltaX);
      var absY = Math.abs(e.deltaY);
      if (absY <= absX) return;

      window.scrollBy(0, e.deltaY);
      e.preventDefault();
    },
    { passive: false }
  );
})();
