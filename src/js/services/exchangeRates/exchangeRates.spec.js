describe('exchange rate api service', () => {

  let $exchangeRate;

  beforeEach(module('copayApp.services'));

  beforeEach(() => {
    inject((exchangeRate) => {
      $exchangeRate = exchangeRate;
    });
  });

  it('Must contain a get method', () => {
    expect($exchangeRate.get).toBeDefined();
    expect(typeof $exchangeRate.get === 'function').toBe(true);
  });
});

