describe('just checking', () => {
  it('has a dummy spec to test 2 + 2', function() {
    // An intentionally failing test. No code within expect() will never equal 4.
    expect(2 + 2).toEqual(4);
  });
});