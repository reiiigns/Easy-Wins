/**
 * Easy Wins — Landing Page Script
 * Minimal interactivity for the landing page.
 */

(function() {
    'use strict';

    // Track CTA button clicks
    const ctaSelectors = ['#cta-main', '#cta-bottom'];
    
    ctaSelectors.forEach(function(selector) {
        const button = document.querySelector(selector);
        if (button) {
            button.addEventListener('click', function(e) {
                const href = button.getAttribute('href');
                console.log('[Easy Wins] CTA clicked:', {
                    selector: selector,
                    url: href,
                    timestamp: new Date().toISOString()
                });
            });
        }
    });

    // Smooth scroll for anchor links (if any added later)
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Log page view (for analytics setup reference)
    console.log('[Easy Wins] Landing page loaded at:', new Date().toISOString());
})();