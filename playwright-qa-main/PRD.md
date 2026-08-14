# Playwright QA — Testability Requirements

## Project Overview

Build a robust **Playwright framework using TypeScript** to automate comprehensive end-to-end testing for the website:

[https://conduit.bondaracademy.com/](https://conduit.bondaracademy.com/)

## Requirements

Implement the following scenarios, ensuring **at least one positive test case for each**:

1. **Create New Article**
2. **Edit Article**

   * Create the article via API as a pre-condition.
3. **Delete Article**

   * Create the article via API as a pre-condition.
4. **Filter Articles by Tag**
5. **Update User Settings**

## Key Considerations

### 1. QA-Driven Assertions

Ensure thorough validation with necessary assertions for each scenario. Focus on both **UI and functional correctness**, including:

* Visual elements
* Success messages
* Redirects
* Data persistence

### 2. Session Management

Reuse authenticated sessions to optimize performance and reduce test execution time.

Implement session persistence to avoid repeated logins where applicable.

### 3. Best Practices

Follow industry-standard best practices for code structure, such as separating:

* Page Objects
* Utilities
* Test data

Focus on:

* Modularity
* Readability
* Maintainability
* Future scalability of the framework

### 4. Resilient Tests

Ensure tests are resilient against minor UI changes.

Use:

* Flexible/reliable locators
* Retry mechanisms when needed
* Strategies to handle dynamic web elements and reduce test flakiness

## Bonus Features

### 1. Dynamic Test Data

Implement dynamic and randomized test data generation to avoid hard-coded inputs and increase test coverage across different input cases.

### 2. Readable Test Reports

Configure detailed and well-structured test reports, such as:

* Allure reports
* HTML reports

Reports should make it easier for teams to analyze:

* Failures
* Errors
* Test results

### 3. Negative Test Cases

Add **at least one negative test case for each scenario**.

Test edge cases and invalid inputs to verify:

* Proper error handling
* Validation messages
* User feedback

### 4. Use AI Tools

Use AI tools where appropriate, **but do not use them blindly**.

### 5. Cross-Browser Testing

Where possible, configure the framework for cross-browser compatibility:

* Chromium
* WebKit
* Firefox

Ensure the web application performs consistently across different browsers.

### 6. Parallel Test Execution

Optimize test suite execution by enabling parallel test runs.

This should speed up testing, especially as the number of test cases increases.

### 7. Test Traceability

Capture **Playwright traces and screenshots on test failure** for easier debugging.

Link them to the CI/CD pipeline or test reports for better traceability.

### 8. CI/CD Integration

Set up the framework to run tests automatically within a **CI/CD pipeline (GitHub Actions)** to ensure continuous quality validation on every code change.
