'use strict';

const _ = require('lodash');
const webdriver = require('selenium-webdriver');

/**
 * Extend a ThenableWebDriver instance with helper functions.
 *
 * @param {ThenableWebDriver} driver
 * @param {Object} options
 * @param {string} options.origin - Origin of the test server.
 * @param {string} [options.loaderSelector='[data-test="loader"]:not(.hidden)'] - Selector that identifies blocking loaders.
 * @return {ExtendedDriver}
 */
function extendDriver(driver, options) {
  _.defaults(options, {
    loaderSelector: '[data-test="loader"]:not(.hidden)'
  });

  /**
   * [Key constants](https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_Key.html) from webdriver.
   *
   * @memberof ExtendedDriver
   */
  driver.Key = webdriver.Key;

  /**
   * A shortcut to [`webdriver.until`](https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/until.html).
   *
   * @memberof ExtendedDriver
   */
  driver.until = webdriver.until;

  /**
   * Pause execution for a specified period.
   *
   * @memberof ExtendedDriver
   * @param {number} timeout
   * @return {Promise<Thenable>}
   */
  driver.pause = timeout => {
    // driver.wait throws an exception for this condition, so we catch it.
    return Promise.resolve().then(() => driver.wait(() => {}, timeout).catch(() => {}));
  };

  /**
   * Load a root-relative path. This is an actual page load, not a dynamic routing.
   *
   * @memberof ExtendedDriver
   * @param {string} path - Must be root-relative
   * @return {Promise<Thenable>}
   */
  driver.load = path => {
    return Promise.resolve().then(() => driver.get(`${options.origin}${path}`));
  };

  /**
   * Select an element that should be on the page at this moment.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @return {Promise<WebElement>}
   */
  driver.selectElement = selector => {
    return Promise.resolve().then(() => driver.findElement(webdriver.By.css(selector)));
  };

  /**
   * Wait for an element's absence from the page.
   *
   * This is not about the element's visibility, but about its existence in the HTML.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {number} [timeout=10e3]
   * @return {Promise<Thenable>}
   */
  driver.waitForElementAbsence = (selector, timeout) => {
    timeout = timeout || 10e3;
    const condition = new webdriver.Condition(`for element ${selector} not to be exist`, drv => {
      return drv.findElements(webdriver.By.css(selector)).then(els => {
        return els.length === 0;
      });
    });
    return Promise.resolve(driver.wait(condition, timeout));
  };

  /**
   * Wait for any data-test="loader" elements to leave the page.
   *
   * @memberof ExtendedDriver
   * @param {number} [timeout]
   * @return {Promise<Thenable>}
   */
  driver.waitForLoaders = timeout => {
    return driver.waitForElementAbsence(options.loaderSelector, timeout);
  };

  /**
   * Wait for an element's presence on the page.
   *
   * This is not about the element's visibility, but about its existence in the HTML.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {number} [timeout=10e3]
   * @return {Promise<WebElement>}
   */
  driver.waitForElement = (selector, timeout) => {
    timeout = timeout || 10e3;
    return Promise.resolve()
      .then(() => driver.waitForLoaders(timeout))
      .then(() => driver.wait(webdriver.until.elementLocated(webdriver.By.css(selector)), timeout))
      .then(() => driver.findElement(webdriver.By.css(selector)));
  };

  /**
   * Wait for an element to be visible (and, of course, present in the actual HTML).
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {number} [timeout=10e3]
   * @return {Promise<WebElement>}
   */
  driver.waitForElementToBeVisible = (selector, timeout) => {
    timeout = timeout || 10e3;
    const condition = new webdriver.Condition(`for element ${selector} to be visible`, drv => {
      return drv
        .findElement(webdriver.By.css(selector))
        .then(el => el.isDisplayed())
        .then(value => value === true);
    });
    return Promise.resolve()
      .then(() => driver.waitForElement(selector, timeout))
      .then(() => driver.wait(condition, timeout))
      .then(() => driver.findElement(webdriver.By.css(selector)));
  };

  /**
   * Wait for an element to be invisible (though still present in the actual HTML).
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {number} [timeout=10e3]
   * @return {Promise<WebElement>}
   */
  driver.waitForElementNotToBeVisible = (selector, timeout) => {
    timeout = timeout || 10e3;
    const condition = new webdriver.Condition(`for element ${selector} not to be visible`, drv => {
      return drv
        .findElement(webdriver.By.css(selector))
        .then(el => el.isDisplayed())
        .then(value => value === false);
    });
    return Promise.resolve()
      .then(() => driver.waitForElement(selector, timeout))
      .then(() => driver.wait(condition, timeout))
      .then(() => driver.findElement(webdriver.By.css(selector)));
  };

  /**
   * Wait for the browser to arrive at a certain URL.
   *
   * @memberof ExtendedDriver
   * @param {string | RegExp} pattern - A RegExp or a string that will be converted to a RegExp. If the URL matches
   *   this RegExp, the condition will be satisfied.
   * @param {number} [timeout=10e3]
   * @return {Promise<Thenable>}
   */
  driver.waitForUrl = (pattern, timeout) => {
    timeout = timeout || 10e3;
    if (typeof pattern === 'string') {
      pattern = new RegExp(_.escapeRegExp(pattern));
    }
    return Promise.resolve()
      .then(() => driver.waitForLoaders(timeout))
      .then(() => driver.wait(webdriver.until.urlMatches(pattern), timeout));
  };

  /**
   * Move the mouse over an element.
   *
   * @memberof ExtendedDriver
   * @param {WebElement} element
   * @return {Promise<Thenable>}
   */
  driver.hoverOver = element => {
    return Promise.resolve().then(() => driver.actions().mouseMove(element).perform());
  };

  /**
   * Wait for the first element identified by the selector to have the specified class.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {string | RegExp} className
   * @param {number} [timeout=10e3]
   * @return {Promise<Thenable>}
   */
  driver.waitForElementToHaveClass = (selector, className, timeout) => {
    timeout = timeout || 10e3;
    return driver.waitForLoaders(timeout).then(() => {
      return driver.wait(
        webdriver.until.elementLocated(
          webdriver.By.js(selectElementWithClass, selector, className)
        ),
        timeout
      );
    });
  };

  /**
   * Wait for the first element identified by the selector to not have the specified class.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {string | RegExp} className
   * @param {number} [timeout=10e3]
   * @return {Promise<Thenable>}
   */
  driver.waitForElementNotToHaveClass = (selector, className, timeout) => {
    timeout = timeout || 10e3;
    return driver.waitForLoaders(timeout).then(() => {
      return driver.wait(
        webdriver.until.elementLocated(
          webdriver.By.js(selectElementWithoutClass, selector, className)
        ),
        timeout
      );
    });
  };

  /**
   * Wait for the first element identified by the selector to contain the specified text.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {string | RegExp} text
   * @param {number} [timeout=10e3]
   * @return {Promise<Thenable>}
   */
  driver.waitForElementToHaveText = (selector, text, timeout) => {
    timeout = timeout || 10e3;
    return driver.waitForLoaders(timeout).then(() => {
      return driver.wait(
        webdriver.until.elementLocated(webdriver.By.js(selectElementWithText, selector, text)),
        timeout
      );
    });
  };

  /**
   * Wait for the first element identified by the selector to not have the specified class.
   *
   * @memberof ExtendedDriver
   * @param {string} selector
   * @param {string | RegExp} text
   * @param {number} [timeout=10e3]
   * @return {Promise<Thenable>}
   */
  driver.waitForElementNotToHaveText = (selector, text, timeout) => {
    timeout = timeout || 10e3;
    return driver.waitForLoaders(timeout).then(() => {
      return driver.wait(
        webdriver.until.elementLocated(webdriver.By.js(selectElementWithoutText, selector, text)),
        timeout
      );
    });
  };

  return driver;
}

module.exports = extendDriver;

function selectElementWithClass(selector, className) {
  const element = document.querySelector(selector);
  if (element && element.classList.contains(className)) {
    return [element];
  } else {
    return [];
  }
}

function selectElementWithoutClass(selector, className) {
  const element = document.querySelector(selector);
  if (element && !element.classList.contains(className)) {
    return [element];
  } else {
    return [];
  }
}

function selectElementWithText(selector, pattern) {
  if (typeof pattern === 'string') {
    pattern = new RegExp(_.escapeRegExp(pattern));
  }
  const element = document.querySelector(selector);
  if (element && pattern.test(element.textContent)) {
    return [element];
  } else {
    return [];
  }
}

function selectElementWithoutText(selector, pattern) {
  if (typeof pattern === 'string') {
    pattern = new RegExp(_.escapeRegExp(pattern));
  }
  const element = document.querySelector(selector);
  if (element && !pattern.test(element.textContent)) {
    return [element];
  } else {
    return [];
  }
}

/**
 * A Selenium [ThenableWebDriver](https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_ThenableWebDriver.html)
 * extended with helper functions.
 *
 * @typedef {ThenableWebDriver} ExtendedDriver
 */
