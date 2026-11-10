// app.js

document.addEventListener('DOMContentLoaded', () => {
    // 0. State Management (Firebase / localStorage fallback)
    const USER_ID = 'alex_mercer_01'; // Mock user session ID
    
    const defaultState = {
        xp: 2450,
        confidenceScore: 78,
        modulesCompleted: ['battery_chem', 'hv_safety', 'can_bus'],
        stats: {
            battery: 82,
            thermal: 45,
            canBus: 91
        },
        radar: {
            current: [80, 40, 30, 50, 70, 90], // Diag, Therm, SysArch, Embed, HW, CAN
            shadow: [85, 45, 85, 90, 75, 95]
        }
    };
    
    // Initialize state
    let appState = defaultState;
    
    const loadState = async () => {
        try {
            const res = await fetch(`/api/state/get/${USER_ID}`);
            const data = await res.json();
            if (data.success && data.state) {
                appState = data.state;
                console.log("Loaded state from DB");
            } else {
                // Fallback to local
                const local = localStorage.getItem('skillTechState');
                if (local) appState = JSON.parse(local);
            }
        } catch (e) {
            console.warn("Could not fetch state from DB, using fallback.");
            const local = localStorage.getItem('skillTechState');
            if (local) appState = JSON.parse(local);
        }
        
        // Trigger UI updates that depend on state
        document.dispatchEvent(new Event('stateLoaded'));
    };
    
    const saveState = async () => {
        localStorage.setItem('skillTechState', JSON.stringify(appState));
        try {
            await fetch('/api/state/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, state: appState })
            });
        } catch (e) {
            console.warn("Could not sync state to DB", e);
        }
    };
    
    // Start loading state immediately
    loadState();

    // 1. Navigation handling
    const navItems = document.querySelectorAll('.nav-item');
    
    // Set active class based on current page URL
    const updateActiveNav = () => {
        const path = window.location.pathname;
        let page = path.split('/').pop() || 'index.html';
        
        navItems.forEach(item => {
            if(item.classList) {
                item.classList.remove('active');
                if (item.getAttribute('href') === page) {
                    item.classList.add('active');
                }
            }
        });
    };
    
    updateActiveNav();
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const icon = item.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1.2)';
                setTimeout(() => { icon.style.transform = 'scale(1)'; }, 200);
            }
        });
    });

    // 2. Dashboard Specific Logic (Circular Progress Bars & Generation)
    const initCircularProgress = () => {
        const progressCircles = document.querySelectorAll('.circular-progress');
        
        // Override with state data if present
        const statKeys = ['battery', 'thermal', 'canBus'];
        
        progressCircles.forEach((circle, index) => {
            if(statKeys[index] && appState.stats[statKeys[index]]) {
                circle.setAttribute('data-progress', appState.stats[statKeys[index]]);
            }
            
            const value = parseInt(circle.getAttribute('data-progress'));
            const color = circle.getAttribute('data-color') || 'var(--accent-blue)';
            const bgCircle = circle.querySelector('.bg-circle');
            const progressPath = circle.querySelector('.progress-path');
            const text = circle.querySelector('.progress-text');
            
            if (progressPath && text) {
                // Calculate circumference: 2 * pi * r (r=40 in our SVG)
                const circumference = 2 * Math.PI * 40;
                progressPath.style.strokeDasharray = circumference;
                
                // Calculate offset
                const offset = circumference - (value / 100) * circumference;
                
                // Apply color and offset with animation
                progressPath.style.stroke = color;
                
                // Animate internally
                setTimeout(() => {
                    progressPath.style.strokeDashoffset = offset;
                    
                    // Counter animation
                    let count = 0;
                    const duration = 1500;
                    const interval = duration / value;
                    
                    const counter = setInterval(() => {
                        count++;
                        text.textContent = count + '%';
                        if (count >= value) {
                            clearInterval(counter);
                            text.textContent = value + '%';
                        }
                    }, interval);

                }, 300); // Small delay to ensure CSS is ready
            }
        });
    };

    if (document.querySelector('.dashboard-content')) {
        document.addEventListener('stateLoaded', () => {
            initCircularProgress();
            
            // Dashboard "Generate Fresh Report" Action
            const genBtn = document.querySelector('.welcome-section button');
            if(genBtn) {
                genBtn.addEventListener('click', () => {
                    genBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 8px;"></i> Analyzing...';
                    
                    setTimeout(() => {
                        // Randomize stats slightly to show interactivity
                        appState.stats.battery = Math.min(100, appState.stats.battery + Math.floor(Math.random() * 5));
                        appState.stats.thermal = Math.min(100, appState.stats.thermal + Math.floor(Math.random() * 15)); // improvement
                        appState.stats.canBus = Math.min(100, appState.stats.canBus + Math.floor(Math.random() * 3));
                        appState.confidenceScore = Math.min(100, appState.confidenceScore + Math.floor(Math.random() * 5));
                        saveState().then(() => {
                            window.location.reload(); // Reload to see new stats
                        });
                    }, 1500);
                });
            }
            
            // Update user name/role based on state (optional touch)
            const confidenceMeter = document.querySelector('.confidence-meter .text-gradient');
            if(confidenceMeter) {
                confidenceMeter.textContent = `${appState.confidenceScore}/100`;
                const fill = document.querySelector('.meter-fill');
                if(fill) fill.style.width = `${appState.confidenceScore}%`;
            }
        });
    }

    // 3. Fake performance Chart initialization (Simple SVG line chart simulation)
    const initChart = () => {
        const chartPaths = document.querySelectorAll('.chart-line');
        if (chartPaths.length > 0) {
            chartPaths.forEach(path => {
                const length = path.getTotalLength();
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length;
                
                // Helper to trigger reflow
                path.getBoundingClientRect();
                
                setTimeout(() => {
                    path.style.transition = 'stroke-dashoffset 2s ease-in-out';
                    path.style.strokeDashoffset = '0';
                }, 500);
            });
        }
    };
    
    initChart();

    // 4. Learning Tier Logic (Lock/Unlock & Interaction)
    const initLearningTiers = () => {
        // Update XP display
        const xpBadge = document.querySelector('.xp-badge');
        if(xpBadge) xpBadge.innerHTML = `<i class="fa-solid fa-star"></i> ${appState.xp} XP Total`;
        
        const tiers = document.querySelectorAll('.tier-card');
        tiers.forEach(tier => {
            if (tier.classList.contains('locked')) {
                const items = tier.querySelectorAll('.lesson-item');
                items.forEach(item => {
                    item.style.opacity = '0.5';
                    item.style.pointerEvents = 'none';
                });
            }
        });
        
        // Interactivity for unlocking a module
        const currentItems = document.querySelectorAll('.lesson-item.current');
        currentItems.forEach(item => {
            item.addEventListener('click', () => {
                const icon = item.querySelector('.lesson-icon');
                const action = item.querySelector('.lesson-action');
                const title = item.querySelector('.lesson-title').innerText;
                
                // Show loading state
                icon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
                item.style.pointerEvents = 'none';
                
                setTimeout(() => {
                    // "Complete" the module
                    item.classList.remove('current');
                    item.classList.add('done');
                    icon.innerHTML = '<i class="fa-solid fa-battery-full"></i>';
                    icon.style.background = 'rgba(16, 185, 129, 0.1)';
                    icon.style.color = 'var(--accent-green)';
                    
                    action.innerHTML = '<i class="fa-solid fa-check-circle"></i>';
                    action.style.color = 'var(--accent-green)';
                    
                    const meta = item.querySelector('.lesson-meta span:first-child');
                    if(meta) meta.innerHTML = '<i class="fa-solid fa-check"></i> Completed';
                    meta.style.color = 'var(--text-tertiary)';
                    
                    // Update State
                    appState.xp += 300; // Fake XP award
                    if(!appState.modulesCompleted.includes(title)) {
                        appState.modulesCompleted.push(title);
                    }
                    saveState();
                    
                    // Update XP visual
                    if(xpBadge) xpBadge.innerHTML = `<i class="fa-solid fa-star"></i> ${appState.xp} XP Total`;
                    xpBadge.classList.add('pulse');
                    setTimeout(() => xpBadge.classList.remove('pulse'), 1000);
                    
                    // Unlock next module visually
                    const next = item.nextElementSibling;
                    if(next && next.classList.contains('locked')) {
                        next.classList.remove('locked');
                        next.classList.add('current');
                        next.style.opacity = '1';
                        next.style.pointerEvents = 'auto';
                        next.style.filter = 'none';
                        
                        const nextIcon = next.querySelector('.lesson-icon');
                        nextIcon.innerHTML = '<i class="fa-solid fa-play"></i>';
                        nextIcon.style.background = 'rgba(59, 130, 246, 0.1)';
                        nextIcon.style.color = '#fff';
                        
                        const nextAction = next.querySelector('.lesson-action');
                        nextAction.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
                        
                        const nextMeta = next.querySelector('.lesson-meta span:first-child');
                        if(nextMeta) nextMeta.innerHTML = 'In Progress';
                        nextMeta.style.color = 'var(--accent-blue)';
                    }
                }, 2000); // 2 second mock learning delay
            });
        });
    };

    if (document.querySelector('.learning-content')) {
        document.addEventListener('stateLoaded', () => {
            initLearningTiers();
        });
    }

    // 5. AI Interview Logic (Chat simulation)
    const initChat = () => {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const chatBox = document.querySelector('.chat-messages');
        
        if (chatInput && sendBtn && chatBox) {
            let messageCount = 0;
            
            const addMessage = (text, isUser) => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `message fade-in ${isUser ? 'user-message' : 'ai-message'}`;
                
                msgDiv.innerHTML = `
                    <div class="msg-bubble">
                        <p class="text-body ${isUser ? 'text-white' : ''}">${text}</p>
                    </div>
                `;
                
                chatBox.appendChild(msgDiv);
                chatBox.scrollTop = chatBox.scrollHeight;
                
                // Animate waveform indicator if AI is "speaking"
                if (!isUser) {
                    const waveform = document.querySelector('.waveform-animation');
                    if (waveform) waveform.classList.add('active');
                    setTimeout(() => {
                        if (waveform) waveform.classList.remove('active');
                    }, 2000);
                }
            };
            
            let chatHistory = [];

            const handleSend = async () => {
                const text = chatInput.value.trim();
                if (text) {
                    addMessage(text, true);
                    chatInput.value = '';
                    messageCount++;
                    
                    // Add typing indicator
                    const typingId = 'typing-' + Date.now();
                    const typingDiv = document.createElement('div');
                    typingDiv.id = typingId;
                    typingDiv.className = 'message fade-in ai-message';
                    typingDiv.innerHTML = `<div class="msg-bubble"><p class="text-body"><i class="fa-solid fa-circle-notch fa-spin"></i> Processing...</p></div>`;
                    chatBox.appendChild(typingDiv);
                    chatBox.scrollTop = chatBox.scrollHeight;

                    try {
                        const res = await fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: text, history: chatHistory })
                        });
                        const data = await res.json();
                        
                        // Remove typing
                        document.getElementById(typingId).remove();

                        if (data.success) {
                            addMessage(data.response, false);
                            chatHistory.push({ role: 'user', parts: [{ text }]});
                            chatHistory.push({ role: 'model', parts: [{ text: data.response }]});
                            
                            // Update accuracy
                            const accuracyP = document.getElementById('rt-accuracy');
                            if(accuracyP && data.accuracy) accuracyP.style.width = data.accuracy + '%';
                            const accuracyText = document.getElementById('rt-accuracy-text');
                            if(accuracyText && data.accuracy) accuracyText.textContent = data.accuracy + '%';

                            // End after 3 turns
                            if (messageCount >= 3) {
                                setTimeout(() => {
                                   addMessage("Excellent responses. Your diagnostics approach shows strong logical flow. I am increasing your Systems Architecture shadow score.", false);
                                   appState.confidenceScore = Math.min(100, appState.confidenceScore + 5);
                                   appState.radar.shadow[2] = Math.min(100, appState.radar.shadow[2] + 10);
                                   saveState();
                                   setTimeout(() => {
                                        const endBtn = document.querySelector('.ai-panel button');
                                        if(endBtn) {
                                            endBtn.innerHTML = '<i class="fa-solid fa-check-circle" style="margin-right: 6px;"></i> Interview Complete - Return to Dashboard';
                                            endBtn.style.color = 'var(--accent-green)';
                                            endBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                            endBtn.addEventListener('click', () => window.location.href = 'index.html');
                                        }
                                   }, 1000);
                                }, 1500);
                            }
                        } else {
                            addMessage("Sorry, I am having trouble connecting to my neural net.", false);
                        }
                    } catch (e) {
                        document.getElementById(typingId)?.remove();
                        addMessage("Connection error while calling AI. " + e.message, false);
                    }
                }
            };
            
            sendBtn.addEventListener('click', handleSend);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSend();
            });
        }
    };
    
    if (document.querySelector('.interview-content')) {
        initChat();
        
        // Let end button return to dashboard manually
        const endBtn = document.querySelector('.ai-panel button');
        if(endBtn && !endBtn.onclick) { // if not already modified
            endBtn.addEventListener('click', () => window.location.href = 'index.html');
        }
    }

    // 6. Fetching AI Insights from Backend
    const initInsights = async () => {
        const insightsContainer = document.getElementById('insights-container');
        if (!insightsContainer) return;

        try {
            insightsContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-blue); font-size: 1.5rem;"></i><p class="text-small" style="margin-top: 10px;">Generating True AI Insights...</p></div>';
            
            const response = await fetch('/api/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stats: appState.stats })
            });
            const data = await response.json();
            
            if (data.success && data.insights) {
                // Clear container
                insightsContainer.innerHTML = '';
                
                // Add insights
                data.insights.forEach(insight => {
                    const card = document.createElement('div');
                    card.className = `insight-card ${insight.type} fade-in`;
                    
                    card.innerHTML = `
                        <div class="insight-header">
                            <span class="insight-title">${insight.title}</span>
                            <span class="insight-action">${insight.actionText} <i class="fa-solid ${insight.icon}"></i></span>
                        </div>
                        <p class="text-body" style="font-size: 0.85rem;">${insight.description}</p>
                    `;
                    insightsContainer.appendChild(card);
                });

                // Update confidence score if present on page
                const scoreElement = document.querySelector('.confidence-meter .text-gradient');
                if (scoreElement && data.confidenceScore) {
                    scoreElement.textContent = `${data.confidenceScore}/100`;
                }
            }
        } catch (error) {
            console.error("Error fetching insights:", error);
            insightsContainer.innerHTML = '<p class="text-small" style="color: var(--accent-red);">Failed to load AI insights. Please try again later.</p>';
        }
    };

    // Run on dashboard
    if (document.querySelector('.dashboard-content')) {
        document.addEventListener('stateLoaded', () => {
            initInsights();
        });
    }

    // 7. Dynamic Radar Chart Generation
    const initRadar = () => {
        const polygonBg = document.querySelector('.radar-polygon-bg');
        const polygonShadow = document.querySelector('.radar-polygon-shadow');
        
        if(polygonBg && polygonShadow) {
            // Helper function to map percentage (0-100) to svg coordinates
            // Center is 200,200. Radius max is 200. (so point is between 0 to R=200 distance from center)
            // Angles: 0, 60, 120, 180, 240, 300 degrees => converted to rads where 0 is north
            const mapDataToPath = (dataArray) => {
                // Adjusting radius scaling since axes lengths aren't strictly R=200 in the mocked SVG layout 
                // We use relative R scaling to fit the existing visual
                const R = 180; 
                let points = [];
                for(let i=0; i<6; i++) {
                    const angleDeg = i * 60;
                    const angleRad = (angleDeg - 90) * (Math.PI / 180); // -90 to start at 'North'
                    
                    const valRadius = R * (dataArray[i] / 100);
                    
                    const x = 200 + valRadius * Math.cos(angleRad);
                    const y = 200 + valRadius * Math.sin(angleRad);
                    
                    points.push(`${Math.round(x)},${Math.round(y)}`);
                }
                return points.join(' ');
            };

            // Use the state data to draw!
            const bgPoints = mapDataToPath(appState.radar.current);
            const shadowPoints = mapDataToPath(appState.radar.shadow);
            
            // Set dynamic points
            polygonBg.setAttribute('points', bgPoints);
            polygonShadow.setAttribute('points', shadowPoints);
            
        }
    };

    if (document.querySelector('.radar-visualization')) {
        document.addEventListener('stateLoaded', () => {
            initRadar();
        });
    }
});
