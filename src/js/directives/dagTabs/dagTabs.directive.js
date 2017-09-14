(() => {
  'use strict';

  angular
    .module('copayApp.directives')


    /**
     * @desc collection of tabs
     * @example <dag-tabset></dag-tabset>
     */
    .directive('dagTabset', dagTabset)

    /**
     * @desc single tab
     * @example <dag-tab heading="Header"></dag-tab>
     */
    .directive('dagTab', dagTab);

  dagTabset.$inject = ['$rootScope'];

  function dagTabset($rootScope) {
    return {
      restrict: 'E',
      transclude: true,
      scope: {},
      templateUrl: 'directives/dagTabs/dagTabs.template.html',
      controllerAs: 'tabset',
      controller: function ($scope, $element) {
        const self = this;
        self.tabs = [];
        self.activeTab = 0;
        self.slider_width = 50;

        self.addTab = (tab) => {
          self.tabs.push(tab);

          if (self.tabs.length === 1) {
            tab.active = true;
          }

          self.slider_width = ($element[0].getElementsByClassName('dag_tabs')[0].clientWidth / self.tabs.length);
        };

        function moveSlide(index) {
          if (!$rootScope.no_animation) {
            TweenMax.to($element[0].getElementsByClassName('dag_tabs_slider')[0], 0.3, {
              ease: Expo.easeOut,
              x: (self.slider_width * index)
            });
          }
        }

        self.restoreSlide = () => {
          moveSlide(self.activeTab);
        };

        self.moveSlide = (index) => {
          moveSlide(index);
        };

        self.select = (selectedTab, index) => {
          if (self.activeTab === index) {
            return false;
          }

          self.tabs = self.tabs.map((tab) => {
            tab.active = false;
            return tab;
          });

          moveSlide(index);

          self.activeTab = index;

          selectedTab.active = true;
        };
      }
    };
  }

  dagTab.$inject = [];

  function dagTab() {
    return {
      restrict: 'E',
      transclude: true,
      template: '<div class="dag_tabs_tabpanel" ng-show="active" ng-transclude></div>',
      require: '^dagTabset',
      scope: {
        heading: '@',
        tabClick: '&'
      },
      link: ($scope, element, attr, dagtabsetCtrl) => {
        $scope.active = false;
        dagtabsetCtrl.addTab($scope);
      }
    };
  }
})();
