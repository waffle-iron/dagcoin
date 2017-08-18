(function () {
  'use strict';

  /**
   * @desc Firing scroll even on scrolling div with class name "'copayApp.directives'"
   * @example <div class="scrollable"></div>
   */
  angular
      .module('copayApp.directives')
      .directive('scrollable', scrollable);

  scrollable.$inject = [];

  function scrollable() {
    return {
      restrict: 'C',
      scope: {
        f: '&',
      },
      link: ($scope, element) => {
        element.bind('scroll', function () {
          document.getElementsByClassName('topbar-container')[0].style.backgroundColor = `rgba(255,255,255,${this.scrollTop > 40 ? 1 : this.scrollTop / 40})`;
        });
      },
    };
  }
}());
