/* global inject */

describe('svgIcon directive', () => {
  let element;
  let scope;
  let $httpBackend;
  const svgName = 'menu';

  beforeEach(module('templates'));
  beforeEach(module('copayApp.directives'));

  beforeEach(inject((_$controller_, _$httpBackend_) => {
    $httpBackend = _$httpBackend_;

    // $httpBackend allows to pass requests through
    $httpBackend.whenGET('/public/css/svg/menu.svg').respond('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><title>menu</title><path d="M0 5.091v4.364h4.364V5.091H0zm7.273 0v4.364h20.364V5.091H7.273zM0 13.818v4.364h4.364v-4.364H0zm7.273 0v4.364h14.545v-4.364H7.273zM0 22.545v4.364h4.364v-4.364H0zm7.273 0v4.364H32v-4.364H7.273z"/></svg>');
  }));

  beforeEach(() => {
    element = angular.element(`<svg-icon name="${svgName}"></svg-icon>`);
    inject(($rootScope, $compile) => {
      scope = $rootScope.$new();

      scope.name = name;
      $compile(element)(scope);
      scope.$digest();
    });
  });

  it('Element must contain a class', () => {
    $httpBackend.flush();
    expect(element.hasClass(`svg-icon-${svgName}`)).toBe(true);
  });

  it('Element should contain svg', () => {
    $httpBackend.flush();
    const svg = element.find('svg');
    expect(svg).toBeDefined();
  });

  it('Element should contain title', () => {
    $httpBackend.flush();
    const title = element.find('title');
    expect(title).toBeDefined();
  });

  it('Title should contain name of the icon', () => {
    $httpBackend.flush();
    const title = element.find('title');
    expect(title.text()).toEqual(svgName);
  });

  it('No name should return an empty html', () => {
    scope.name = false;
    element = angular.element('<svg-icon></svg-icon>');
    expect(element.html()).toEqual('');
  });
});
