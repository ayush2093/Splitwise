import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-logo">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" fill="#1abc9c" />
              <path d="M12 2L7 12h10L12 2z" fill="#16a085" />
            </svg>
            <span>Splitwise</span>
          </div>
          <div className="landing-nav-links">
            <Link to="/login" className="landing-nav-link-btn text">Log in</Link>
            <Link to="/signup" className="landing-nav-link-btn fill">Sign up</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-container">
          <div className="landing-hero-left">
            <h1 className="landing-hero-title">
              Less stress when<br />sharing expenses<br />
              <span className="purple-text">with housemates.</span>
            </h1>
            
            <div className="landing-hero-icons">
              <span className="landing-hero-icon-item">✈️</span>
              <span className="landing-hero-icon-item">🏠</span>
              <span className="landing-hero-icon-item">💖</span>
              <span className="landing-hero-icon-item">🌟</span>
            </div>

            <p className="landing-hero-desc">
              Keep track of your shared expenses and balances with housemates, trips, groups, friends, and family.
            </p>

            <Link to="/signup" className="btn btn-purple-hero">Sign up</Link>
            <div className="landing-hero-sub">Free for iPhone, Android, and web.</div>
          </div>

          <div className="landing-hero-right">
            {/* SVG replica of the Splitwise purple tiled house logo */}
            <svg className="landing-house-art" viewBox="0 0 400 400" width="100%" height="320">
              <g transform="translate(40, 20)">
                {/* Roof tiles using triangular polygons representing the purple pattern */}
                <polygon points="160,30 210,110 110,110" fill="#8e44ad" />
                <polygon points="210,110 260,190 160,190" fill="#7d3c98" />
                <polygon points="110,110 160,190 60,190" fill="#9b59b6" />
                
                {/* Chimney */}
                <rect x="230" y="60" width="30" height="70" fill="#6c3483" />
                <polygon points="230,60 260,60 245,40" fill="#5b2c6f" />

                {/* Right Roof Slope extension */}
                <polygon points="260,190 310,270 210,270" fill="#6c3483" />
                
                {/* Left Roof Slope extension */}
                <polygon points="60,190 110,270 10,270" fill="#a569bd" />

                {/* Main House Wall Columns */}
                <rect x="110" y="190" width="50" height="160" fill="#7d3c98" />
                <rect x="160" y="270" width="100" height="80" fill="#5b2c6f" />
                <rect x="260" y="270" width="50" height="80" fill="#4a235a" />

                {/* Decorative Pattern overlays */}
                <polygon points="110,190 160,190 135,230" fill="#af7ac5" opacity="0.8" />
                <polygon points="210,270 260,270 235,310" fill="#884ea0" opacity="0.8" />
                <polygon points="160,310 210,310 185,350" fill="#512e5f" opacity="0.8" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* Feature Section 1: Track Balances & Organize Expenses */}
      <section className="landing-features-split">
        {/* Track Balances Column (Charcoal background) */}
        <div className="feature-col dark-grey">
          <div className="feature-col-content">
            <h2 className="feature-col-title">Track balances</h2>
            <p className="feature-col-desc">Keep track of shared expenses, balances, and who owes who.</p>
            
            {/* Phone Mockup 1 */}
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="mock-phone-header">
                  <span>Friends</span>
                  <span className="search-icon">🔍</span>
                </div>
                <div className="mock-balance-summary">
                  <div className="mock-bal-col">
                    <span className="lbl">you owe</span>
                    <span className="val red">€92.21</span>
                  </div>
                  <div className="mock-bal-divider"></div>
                  <div className="mock-bal-col">
                    <span className="lbl">you are owed</span>
                    <span className="val green">£20.00</span>
                  </div>
                </div>
                <div className="mock-phone-list">
                  <div className="mock-list-item">
                    <div className="mock-avatar avatar-ele">E</div>
                    <div className="mock-item-info">
                      <span className="name">Earl E. Phant</span>
                      <span className="status red">you owe €92.21</span>
                    </div>
                  </div>
                  <div className="mock-list-item">
                    <div className="mock-avatar avatar-gajah">G</div>
                    <div className="mock-item-info">
                      <span className="name">Gajah</span>
                      <span className="status green">owes you £20.00</span>
                    </div>
                  </div>
                  <div className="mock-list-item">
                    <div className="mock-avatar avatar-jorge">J</div>
                    <div className="mock-item-info">
                      <span className="name">Jorge Jirafa</span>
                      <span className="status grey">settled up</span>
                    </div>
                  </div>
                  <div className="mock-list-item">
                    <div className="mock-avatar avatar-oli">O</div>
                    <div className="mock-item-info">
                      <span className="name">Oli Fant</span>
                      <span className="status red">you owe $17.51</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organize Expenses Column (Teal background) */}
        <div className="feature-col teal">
          <div className="feature-col-content">
            <h2 className="feature-col-title">Organize expenses</h2>
            <p className="feature-col-desc">Split expenses with any group: trips, housemates, friends, and family.</p>
            
            {/* Phone Mockup 2 */}
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="mock-phone-header header-teal">
                  <span>Elle & Earl</span>
                  <span className="cog-icon">⚙️</span>
                </div>
                <div className="mock-actions-row">
                  <span className="mock-action-btn">Settle up</span>
                  <span className="mock-action-btn">Balances</span>
                  <span className="mock-action-btn">Totals</span>
                </div>
                <div className="mock-phone-list">
                  <div className="mock-list-item">
                    <div className="mock-cat-icon">🍞</div>
                    <div className="mock-item-info">
                      <span className="name">Ellie's bakery</span>
                      <span className="payer">You paid $102.72</span>
                      <span className="status green">you lent $51.36</span>
                    </div>
                  </div>
                  <div className="mock-list-item">
                    <div className="mock-cat-icon">⛽</div>
                    <div className="mock-item-info">
                      <span className="name">Fuel up</span>
                      <span className="payer">Earl E. paid $48.06</span>
                      <span className="status red">you borrowed $24.03</span>
                    </div>
                  </div>
                  <div className="mock-list-item">
                    <div className="mock-cat-icon">🎬</div>
                    <div className="mock-item-info">
                      <span className="name">Movie night</span>
                      <span className="payer">You paid $5.00</span>
                      <span className="status green">you lent $2.50</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 2: Add Expenses Easily & Pay Friends Back */}
      <section className="landing-features-split">
        {/* Add Expenses Column (Orange background) */}
        <div className="feature-col orange">
          <div className="feature-col-content">
            <h2 className="feature-col-title">Add expenses easily</h2>
            <p className="feature-col-desc">Quickly add expenses on the go before you forget who paid.</p>
            
            {/* Phone Mockup 3 */}
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="mock-phone-header header-orange">
                  <span>Add an expense</span>
                  <span className="save-btn">Save</span>
                </div>
                <div className="mock-expense-form">
                  <div className="form-row">
                    <span className="lbl">With you and:</span>
                    <span className="tag">All of Tuscany trip ❤️</span>
                  </div>
                  <div className="form-input-box">
                    <span className="cat-box">🚕</span>
                    <div className="inputs">
                      <input type="text" className="desc" value="Taxi" readOnly />
                      <input type="text" className="val" value="$ 18.73" readOnly />
                    </div>
                  </div>
                  <div className="form-payer-summary">
                    Paid by <strong className="green-text">you</strong> and split <strong className="green-text">equally</strong>.
                  </div>
                  <div className="form-cent-indicator">($9.37/person)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pay Friends Back Column (Dark grey background) */}
        <div className="feature-col dark-grey">
          <div className="feature-col-content">
            <h2 className="feature-col-title">Pay friends back</h2>
            <p className="feature-col-desc">Settle up with a friend and record any cash or online payment.</p>
            
            {/* Phone Mockup 4 */}
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="mock-phone-header">
                  <span>Settle up</span>
                  <span className="save-btn">Save</span>
                </div>
                <div className="mock-settle-screen">
                  <div className="avatar-transfer-row">
                    <div className="mock-avatar avatar-ele">E</div>
                    <div className="arrow">➡️</div>
                    <div className="mock-avatar avatar-gajah">G</div>
                  </div>
                  <p className="transfer-summary">You paid <strong>Earl E.</strong></p>
                  <div className="transfer-value-box">$ 92.21</div>
                  <div className="cash-badge">Recorded as cash</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 3: PRO Purple Banner */}
      <section className="landing-pro-section">
        <div className="landing-pro-container">
          <div className="landing-pro-left">
            <h2 className="pro-title">Get even more with PRO</h2>
            <p className="pro-desc">
              Get even more organized with receipt scanning, charts and graphs, currency conversion, and more!
            </p>
            <Link to="/signup" className="btn btn-pro-outline">Sign up</Link>
          </div>

          <div className="landing-pro-right">
            {/* Phone Mockup 5 (PRO) */}
            <div className="phone-mockup pro-mock">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="mock-phone-header header-purple">
                  <span>Details</span>
                  <span className="edit-btn">✏️</span>
                </div>
                <div className="mock-pro-splits">
                  <div className="title-row">
                    <span>Ellie's Bakery</span>
                    <strong>$102.71</strong>
                  </div>
                  <div className="pro-split-list">
                    <div className="pro-split-item">
                      <span>You paid</span>
                      <strong>$102.71</strong>
                    </div>
                    <div className="pro-split-item italic">
                      <span>You owe</span>
                      <strong>$30.09</strong>
                    </div>
                    <div className="pro-split-item italic">
                      <span>Earl E. owes</span>
                      <strong>$41.08</strong>
                    </div>
                    <div className="pro-split-item italic">
                      <span>Stompy owes</span>
                      <strong>$31.54</strong>
                    </div>
                  </div>
                  
                  <div className="pro-charts">
                    <span className="charts-lbl">Spending by category</span>
                    <div className="bar-chart">
                      <div className="bar-row">
                        <span className="m">May</span>
                        <div className="b-outer"><div className="b-inner" style={{ width: '10%' }}></div></div>
                        <span className="v">$0.00</span>
                      </div>
                      <div className="bar-row">
                        <span className="m">June</span>
                        <div className="b-outer"><div className="b-inner purple" style={{ width: '85%' }}></div></div>
                        <span className="v">$102.71</span>
                      </div>
                      <div className="bar-row">
                        <span className="m">July</span>
                        <div className="b-outer"><div className="b-inner" style={{ width: '10%' }}></div></div>
                        <span className="v">$0.00</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 Splitwise Clone. All rights reserved. Built for evaluation purposes.</p>
      </footer>
    </div>
  );
}
