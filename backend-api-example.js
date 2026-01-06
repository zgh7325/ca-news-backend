const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://canews2026:canews2026@cacluster.pfmukuj.mongodb.net/?appName=CAcluster';
const DATABASE_NAME = 'canews';
const COLLECTION_NAME = 'sports';
const GENERAL_COLLECTION_NAME = 'general';
const ROSTER_COLLECTION_NAME = 'roster';
const ACADEMIC_COLLECTION_NAME = 'academic';
const RESULT_COLLECTION_NAME = 'result';

let db;
let client;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB with retry logic
async function connectToMongoDB() {
    const maxRetries = 5;
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            if (client) {
                await client.close();
            }
            client = new MongoClient(MONGODB_URI);
            await client.connect();
            db = client.db(DATABASE_NAME);
            console.log('✅ Connected to MongoDB successfully');
            return; // Success, exit function
        } catch (error) {
            retries++;
            console.error(`❌ MongoDB connection error (attempt ${retries}/${maxRetries}):`, error.message);
            if (retries < maxRetries) {
                console.log(`⏳ Retrying in 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.error('❌ Failed to connect to MongoDB after', maxRetries, 'attempts');
            }
        }
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend API is running' });
});

// Get all sports events
app.get('/api/sports', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 FETCHING FROM MONGODB:');
        console.log(`   Database: ${DATABASE_NAME}`);
        console.log(`   Collection: ${COLLECTION_NAME}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Fetch ALL documents with no filter
        const documents = await collection.find({}).toArray();
        
        console.log(`🔍 Query: find({}) - No filters applied`);
        console.log(`📊 Raw count from MongoDB: ${documents.length} documents`);
        
        // Log all document IDs and their structures
        console.log(`\n📋 All Documents Summary:`);
        documents.forEach((doc, idx) => {
            console.log(`   Document ${idx + 1}: _id=${doc._id}`);
            console.log(`      Has upcoming_events: ${Array.isArray(doc.upcoming_events)}`);
            if (Array.isArray(doc.upcoming_events)) {
                const dates = doc.upcoming_events.map(dg => dg.date).filter(Boolean);
                const uniqueMonths = new Set(dates.map(d => {
                    try {
                        return d.substring(0, 7); // YYYY-MM
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean));
                console.log(`      Months in upcoming_events: ${Array.from(uniqueMonths).sort().join(', ') || 'NONE'}`);
                console.log(`      Total date groups: ${doc.upcoming_events.length}`);
            }
            const allKeys = Object.keys(doc);
            console.log(`      All keys: ${allKeys.join(', ')}`);
        });
        console.log('');
        
        console.log(`✅ Found ${documents.length} documents in MongoDB`);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 RAW MONGODB DOCUMENTS (Before Processing):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        documents.forEach((doc, index) => {
            console.log(`[Document ${index + 1} of ${documents.length}]`);
            console.log(`   Document ID: ${doc._id}`);
            console.log(`   Has upcoming_events array: ${Array.isArray(doc.upcoming_events)}`);
            
            // Log the FULL structure of the first document to understand the data structure
            if (index === 0) {
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📋 FULL DOCUMENT STRUCTURE (First Document):');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(JSON.stringify(doc, null, 2).substring(0, 2000)); // First 2000 chars
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            }
            
            if (Array.isArray(doc.upcoming_events)) {
                console.log(`   Number of date groups in upcoming_events: ${doc.upcoming_events.length}`);
                let totalEventsInDoc = 0;
                const datesInDoc = new Set();
                
                doc.upcoming_events.forEach((dateGroup, dgIndex) => {
                    // Check if events is an array
                    const eventsInGroup = dateGroup.events ? dateGroup.events.length : 0;
                    
                    // Check if dateGroup itself is an event object (not containing events array)
                    const dateGroupKeys = Object.keys(dateGroup);
                    const hasEventFields = dateGroupKeys.some(key => 
                        ['event_name', 'eventName', 'sport', 'team', 'opponent', 'time'].includes(key)
                    );
                    
                    if (hasEventFields && !dateGroup.events) {
                        console.log(`   Date Group ${dgIndex + 1} (${dateGroup.date}): IS AN EVENT OBJECT (not array)`);
                        totalEventsInDoc += 1;
                        if (dateGroup.date) {
                            datesInDoc.add(dateGroup.date);
                        }
                    } else {
                        console.log(`   Date Group ${dgIndex + 1} (${dateGroup.date}): ${eventsInGroup} events in array`);
                        totalEventsInDoc += eventsInGroup;
                        if (dateGroup.date) {
                            datesInDoc.add(dateGroup.date);
                        }
                    }
                    
                    // Show structure of first few date groups
                    if (dgIndex < 3) {
                        console.log(`   Date Group ${dgIndex + 1} keys: ${dateGroupKeys.join(', ')}`);
                        console.log(`   Date Group ${dgIndex + 1} sample:`, JSON.stringify(dateGroup, null, 2).substring(0, 400));
                    }
                });
                
                // Log unique dates in this document
                const sortedDates = Array.from(datesInDoc).sort();
                const monthsInDoc = new Set();
                sortedDates.forEach(date => {
                    try {
                        const dateObj = new Date(date);
                        const month = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                        monthsInDoc.add(month);
                    } catch (e) {}
                });
                
                console.log(`   TOTAL events in this document: ${totalEventsInDoc}`);
                console.log(`   Unique dates in this document: ${sortedDates.length} (${sortedDates.slice(0, 5).join(', ')}${sortedDates.length > 5 ? '...' : ''})`);
                console.log(`   Months in this document: ${Array.from(monthsInDoc).sort().join(', ')}`);
            } else {
                // Check for other possible event structures
                console.log(`   Checking for alternative event structures...`);
                const keys = Object.keys(doc);
                console.log(`   Document keys: ${keys.join(', ')}`);
                if (doc.events && Array.isArray(doc.events)) {
                    console.log(`   ⚠️ Found 'events' array with ${doc.events.length} items`);
                }
                if (doc.sportsEvents && Array.isArray(doc.sportsEvents)) {
                    console.log(`   ⚠️ Found 'sportsEvents' array with ${doc.sportsEvents.length} items`);
                }
            }
            console.log('');
        });
        
        // Extract events ONLY from the upcoming_events array
        // MongoDB document structure: { upcoming_events: [{ date, day, events: [...] }] }
        let allEvents = [];
        
        documents.forEach((doc) => {
            // ONLY process documents that have upcoming_events array
            if (doc.upcoming_events && Array.isArray(doc.upcoming_events)) {
                // Each item in upcoming_events has: { date, day, events: [...] }
                doc.upcoming_events.forEach((dateGroup, dgIndex) => {
                    const dateGroupKeys = Object.keys(dateGroup);
                    
                    // Check if dateGroup itself is an event object (has event fields directly)
                    // MongoDB structure: { date, day, time, event, location, opponent, ... }
                    const hasEventFields = dateGroupKeys.some(key => 
                        ['event', 'event_name', 'eventName', 'sport', 'team', 'opponent', 'time'].includes(key)
                    );
                    
                    if (hasEventFields && (!dateGroup.events || !Array.isArray(dateGroup.events))) {
                        // DateGroup IS the event object itself (MongoDB structure)
                        const location = dateGroup.venue || dateGroup.location || null;
                        
                        // Extract sport and team from event string (e.g., "Basketball (JV Boys)")
                        let sport = dateGroup.sport || 'General';
                        let team = dateGroup.team || null;
                        const eventString = dateGroup.event || '';
                        
                        // Parse event string to extract sport and team if not already present
                        if (eventString && !dateGroup.sport) {
                            // Event format: "Basketball (JV Boys)" or "Basketball - Varsity Girls"
                            const match = eventString.match(/^([^(]+)\s*\(([^)]+)\)/);
                            if (match) {
                                sport = match[1].trim();
                                team = match[2].trim();
                            } else {
                                // Try alternative format
                                const parts = eventString.split('-');
                                if (parts.length >= 2) {
                                    sport = parts[0].trim();
                                    team = parts[1].trim();
                                } else {
                                    sport = eventString.trim();
                                }
                            }
                        }
                        
                        // Extract season from document or dateGroup
                        const season = doc.season || dateGroup.season || doc.Season || dateGroup.Season || 
                                      doc.season_name || dateGroup.season_name || doc.seasonName || dateGroup.seasonName ||
                                      doc.year || dateGroup.year || null;
                        
                        if (season) {
                            console.log(`   ✅ Found season: ${season} for event: ${dateGroup.event || dateGroup.event_name || 'Untitled'}`);
                        } else {
                            console.log(`   ⚠️ No season found for event: ${dateGroup.event || dateGroup.event_name || 'Untitled'}`);
                            console.log(`      Document season fields: doc.season=${doc.season}, doc.Season=${doc.Season}, doc.season_name=${doc.season_name}`);
                            console.log(`      DateGroup season fields: dateGroup.season=${dateGroup.season}, dateGroup.Season=${dateGroup.Season}`);
                        }
                        
                        allEvents.push({
                            _id: doc._id.toString() + '_' + allEvents.length,
                            title: dateGroup.event || dateGroup.event_name || dateGroup.eventName || 'Untitled Event',
                            content: '',
                            sport: sport,
                            opponent: dateGroup.opponent || null,
                            date: dateGroup.date || new Date().toISOString(),
                            time: dateGroup.time || null,
                            location: location,
                            venue: null,
                            author: null,
                            imageName: null,
                            team: team,
                            season: season
                        });
                    } else if (dateGroup.events && Array.isArray(dateGroup.events)) {
                        // Traditional structure: dateGroup has events array
                        // Extract season from document or dateGroup
                        const season = doc.season || dateGroup.season || doc.Season || dateGroup.Season || 
                                      doc.season_name || dateGroup.season_name || doc.seasonName || dateGroup.seasonName ||
                                      doc.year || dateGroup.year || null;
                        
                        dateGroup.events.forEach((event) => {
                            const location = event.venue || event.location || null;
                            const eventSeason = event.season || season || null;
                            
                            if (eventSeason) {
                                console.log(`   ✅ Found season: ${eventSeason} for event: ${event.event || event.event_name || 'Untitled'}`);
                            }
                            
                            allEvents.push({
                                _id: doc._id.toString() + '_' + allEvents.length,
                                title: event.event || event.event_name || event.eventName || 'Untitled Event',
                                content: '',
                                sport: event.sport || 'General',
                                opponent: event.opponent || null,
                                date: dateGroup.date || new Date().toISOString(),
                                time: event.time || null,
                                location: location,
                                venue: null,
                                author: null,
                                imageName: null,
                                team: event.team || null,
                                season: eventSeason
                            });
                        });
                    }
                });
            }
            // Removed fallback - only show events from upcoming_events array
        });
        
        console.log(`📊 Extracted ${allEvents.length} individual events from ${documents.length} document(s)`);
        console.log(`📋 Events by date (showing all months):`);
        const eventsByDate = {};
        const eventsByMonth = {};
        allEvents.forEach(event => {
            const date = event.date;
            if (!eventsByDate[date]) {
                eventsByDate[date] = [];
            }
            eventsByDate[date].push(event.title);
            
            // Group by month for easier viewing
            try {
                const dateObj = new Date(date);
                const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                if (!eventsByMonth[monthKey]) {
                    eventsByMonth[monthKey] = 0;
                }
                eventsByMonth[monthKey]++;
            } catch (e) {
                // Ignore date parsing errors
            }
        });
        
        // Log events by month
        console.log(`\n📅 Events by month:`);
        Object.keys(eventsByMonth).sort().forEach(month => {
            console.log(`   ${month}: ${eventsByMonth[month]} event(s)`);
        });
        
        // Log events by date (first 50 dates)
        console.log(`\n📅 Events by date (first 50 dates):`);
        const sortedDates = Object.keys(eventsByDate).sort();
        sortedDates.slice(0, 50).forEach(date => {
            console.log(`   ${date}: ${eventsByDate[date].length} event(s) - ${eventsByDate[date].slice(0, 3).join(', ')}${eventsByDate[date].length > 3 ? '...' : ''}`);
        });
        if (sortedDates.length > 50) {
            console.log(`   ... and ${sortedDates.length - 50} more dates`);
        }
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📤 FORMATTED EVENTS (After Processing):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Format dates properly and log
        const formattedEvents = allEvents.map((event, index) => {
            // Keep date and time separate - iOS app will handle parsing
            // Date format: "2024-12-27" (YYYY-MM-DD)
            // Time format: "4:15 PM" or "TBD"
            const formatted = {
                _id: event._id,
                title: event.title,
                content: event.content || '',
                sport: event.sport || 'General',
                opponent: event.opponent || null,
                date: event.date, // Keep as "YYYY-MM-DD" format
                time: event.time || null,
                location: event.location || null,
                venue: event.venue || null,
                author: event.author || null,
                imageName: event.imageName || null,
                team: event.team || null,
                season: event.season || null
            };
            
            console.log(`[Formatted Event ${index + 1} of ${allEvents.length}]`);
            console.log(JSON.stringify(formatted, null, 2));
            console.log('');
            
            return formatted;
        });

        // Return ALL events (no date filtering) - let iOS app handle filtering if needed
        console.log(`📅 Total events extracted: ${formattedEvents.length}`);
        
        // Log season information for debugging
        const eventsWithSeason = formattedEvents.filter(e => e.season).length;
        const uniqueSeasons = [...new Set(formattedEvents.map(e => e.season).filter(s => s))];
        console.log(`📊 Events with season: ${eventsWithSeason} of ${formattedEvents.length}`);
        console.log(`📊 Unique seasons found: ${uniqueSeasons.join(', ') || 'NONE'}`);
        
        // Sort by date (ascending - earliest dates first)
        formattedEvents.sort((a, b) => {
            try {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateA - dateB; // Ascending: earliest dates first
            } catch (error) {
                return 0;
            }
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Returning ${formattedEvents.length} sports events (ALL events, no date filter) to iOS app`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        res.json(formattedEvents);
    } catch (error) {
        console.error('❌ Error fetching sports events:', error);
        res.status(500).json({ error: 'Failed to fetch sports events', details: error.message });
    }
});

// Get sports event by ID
app.get('/api/sports/:id', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const collection = db.collection(COLLECTION_NAME);
        const event = await collection.findOne({ _id: new ObjectId(req.params.id) });
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            _id: event._id.toString(),
            title: event.title || 'Untitled Event',
            content: event.content || '',
            sport: event.sport || 'General',
            opponent: event.opponent || null,
            date: event.date || new Date().toISOString(),
            time: event.time || null,
            location: event.location || null,
            venue: event.venue || null,
            author: event.author || null,
            imageName: event.imageName || null
        });
    } catch (error) {
        console.error('❌ Error fetching sports event:', error);
        res.status(500).json({ error: 'Failed to fetch sports event', details: error.message });
    }
});

// Create new sports event
app.post('/api/sports', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const collection = db.collection(COLLECTION_NAME);
        const result = await collection.insertOne(req.body);
        
        console.log(`✅ Created new sports event with ID: ${result.insertedId}`);
        res.status(201).json({ _id: result.insertedId.toString(), ...req.body });
    } catch (error) {
        console.error('❌ Error creating sports event:', error);
        res.status(500).json({ error: 'Failed to create sports event', details: error.message });
    }
});

// Get all general events
app.get('/api/general', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const collection = db.collection(GENERAL_COLLECTION_NAME);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 FETCHING GENERAL EVENTS FROM MONGODB:');
        console.log(`   Database: ${DATABASE_NAME}`);
        console.log(`   Collection: ${GENERAL_COLLECTION_NAME}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Fetch ALL documents with no filter
        const documents = await collection.find({}).toArray();
        
        console.log(`📊 Raw count from MongoDB: ${documents.length} documents`);
        
        // Log document structure for debugging
        if (documents.length > 0) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 DOCUMENT STRUCTURE (First Document):');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(JSON.stringify(documents[0], null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        
        // Extract events from documents
        let allEvents = [];
        
        documents.forEach((doc) => {
            // Check if document has articles array (common structure for general/news events)
            if (doc.articles && Array.isArray(doc.articles)) {
                doc.articles.forEach((article, index) => {
                    // Parse date string (e.g., "December 18, 2025") to ISO format
                    let dateString = article.date || new Date().toISOString();
                    try {
                        // Try to parse common date formats
                        const dateFormats = [
                            'MMMM dd, yyyy',  // "December 18, 2025"
                            'MMM dd, yyyy',   // "Dec 18, 2025"
                            'MMMM d, yyyy',   // "December 1, 2025"
                            'MMM d, yyyy',    // "Dec 1, 2025"
                            'yyyy-MM-dd',     // ISO format
                        ];
                        
                        let parsedDate = null;
                        for (const format of dateFormats) {
                            const date = new Date(article.date);
                            if (!isNaN(date.getTime())) {
                                parsedDate = date.toISOString();
                                break;
                            }
                        }
                        
                        if (parsedDate) {
                            dateString = parsedDate;
                        } else {
                            // Fallback: try to parse as-is
                            const fallbackDate = new Date(article.date);
                            if (!isNaN(fallbackDate.getTime())) {
                                dateString = fallbackDate.toISOString();
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not parse date: ${article.date}, using current date`);
                    }
                    
                    allEvents.push({
                        _id: doc._id.toString() + '_' + index,
                        title: article.title || 'Untitled Event',
                        date: dateString,
                        link: article.link || article.url || article.href || null
                    });
                });
            }
            // Check if document has upcoming_events array (similar to sports structure)
            else if (doc.upcoming_events && Array.isArray(doc.upcoming_events)) {
                doc.upcoming_events.forEach((dateGroup) => {
                    const dateGroupKeys = Object.keys(dateGroup);
                    const hasEventFields = dateGroupKeys.some(key => 
                        ['event', 'event_name', 'eventName', 'title', 'name'].includes(key)
                    );
                    
                    if (hasEventFields && (!dateGroup.events || !Array.isArray(dateGroup.events))) {
                        // DateGroup IS the event object itself
                        allEvents.push({
                            _id: doc._id.toString() + '_' + allEvents.length,
                            title: dateGroup.title || dateGroup.event || dateGroup.event_name || dateGroup.eventName || dateGroup.name || 'Untitled Event',
                            date: dateGroup.date || new Date().toISOString(),
                            link: dateGroup.link || dateGroup.url || dateGroup.href || null
                        });
                    } else if (dateGroup.events && Array.isArray(dateGroup.events)) {
                        // Traditional structure: dateGroup has events array
                        dateGroup.events.forEach((event) => {
                            allEvents.push({
                                _id: doc._id.toString() + '_' + allEvents.length,
                                title: event.title || event.event || event.event_name || event.eventName || event.name || 'Untitled Event',
                                date: dateGroup.date || event.date || new Date().toISOString(),
                                link: event.link || event.url || event.href || null
                            });
                        });
                    }
                });
            } else {
                // If document itself is an event (flat structure)
                if (doc.title || doc.name || doc.event || doc.event_name) {
                    allEvents.push({
                        _id: doc._id.toString(),
                        title: doc.title || doc.name || doc.event || doc.event_name || 'Untitled Event',
                        date: doc.date || new Date().toISOString(),
                        link: doc.link || doc.url || doc.href || null
                    });
                }
            }
        });
        
        console.log(`📊 Extracted ${allEvents.length} general events from ${documents.length} document(s)`);
        
        // Sort by date (descending - most recent first, including past events)
        allEvents.sort((a, b) => {
            try {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA; // Descending: most recent first
            } catch (error) {
                console.log(`⚠️ Could not parse date for sorting. Event A: ${a.title}, Event B: ${b.title}`);
                return 0;
            }
        });
        
        console.log(`✅ Returning ${allEvents.length} general events (including past events) to iOS app\n`);
        
        res.json(allEvents);
    } catch (error) {
        console.error('❌ Error fetching general events:', error);
        res.status(500).json({ error: 'Failed to fetch general events', details: error.message });
    }
});

// Get team roster
app.get('/api/roster', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const collection = db.collection(ROSTER_COLLECTION_NAME);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 FETCHING TEAM ROSTER FROM MONGODB:');
        console.log(`   Database: ${DATABASE_NAME}`);
        console.log(`   Collection: ${ROSTER_COLLECTION_NAME}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Fetch ALL documents
        const documents = await collection.find({}).toArray();
        
        console.log(`📊 Raw count from MongoDB: ${documents.length} documents`);
        
        // Log document structure for debugging
        if (documents.length > 0) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 DOCUMENT STRUCTURE (First Document):');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(JSON.stringify(documents[0], null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        
        // Format roster data organized by sport
        const rosterBySport = {};
        
        documents.forEach((doc, docIndex) => {
            console.log(`\n📄 Processing document ${docIndex + 1}:`);
            console.log(`   Keys: ${Object.keys(doc).join(', ')}`);
            
            // Check if document has a "teams" object (keys are sport names)
            if (doc.teams && typeof doc.teams === 'object' && !Array.isArray(doc.teams)) {
                const teamKeys = Object.keys(doc.teams);
                console.log(`   Found ${teamKeys.length} teams in document`);
                teamKeys.forEach((sportName, teamIndex) => {
                    const team = doc.teams[sportName];
                    console.log(`   Team ${teamIndex + 1}: ${sportName}`);
                    console.log(`   Document keys: ${Object.keys(doc).join(', ')}`);
                    console.log(`   Team keys: ${Object.keys(team).join(', ')}`);
                    console.log(`   Document season: ${doc.season || 'N/A'}`);
                    console.log(`   Team season: ${team.season || 'N/A'}`);
                    
                    // Extract coaches from team
                    let coaches = [];
                    if (team.coaches) {
                        if (Array.isArray(team.coaches)) {
                            coaches = team.coaches.map(c => {
                                if (typeof c === 'string') {
                                    return { name: c };
                                } else if (c && typeof c === 'object') {
                                    return {
                                        name: c.name || 'Unknown Coach',
                                        role: c.role || c.position || null,
                                        email: c.email || null
                                    };
                                }
                                return { name: 'Unknown Coach' };
                            });
                        } else if (typeof team.coaches === 'string') {
                            coaches = [{ name: team.coaches }];
                        } else {
                            coaches = [team.coaches];
                        }
                    } else if (team.coach) {
                        if (Array.isArray(team.coach)) {
                            coaches = team.coach.map(c => typeof c === 'string' ? { name: c } : c);
                        } else if (typeof team.coach === 'string') {
                            coaches = [{ name: team.coach }];
                        } else {
                            coaches = [team.coach];
                        }
                    }
                    
                    // Extract players from team
                    let players = [];
                    if (team.players) {
                        if (Array.isArray(team.players)) {
                            players = team.players.map(p => {
                                if (typeof p === 'string') {
                                    return { name: p };
                                } else if (p && typeof p === 'object') {
                                    return {
                                        name: p.name || p.player_name || p.playerName || 'Unknown',
                                        number: p.number || p.jersey || p.jerseyNumber || null,
                                        position: p.position || p.pos || null,
                                        grade: p.grade || p.gradeLevel || null
                                    };
                                }
                                return { name: 'Unknown' };
                            });
                        } else if (typeof team.players === 'string') {
                            players = [{ name: team.players }];
                        } else {
                            players = [team.players];
                        }
                    } else if (team.roster && Array.isArray(team.roster)) {
                        players = team.roster.map(p => {
                            if (typeof p === 'string') {
                                return { name: p };
                            } else if (p && typeof p === 'object') {
                                return {
                                    name: p.name || p.player_name || p.playerName || 'Unknown',
                                    number: p.number || p.jersey || p.jerseyNumber || null,
                                    position: p.position || p.pos || null,
                                    grade: p.grade || p.gradeLevel || null
                                };
                            }
                            return { name: 'Unknown' };
                        });
                    }
                    
                    console.log(`      ${coaches.length} coaches, ${players.length} players`);
                    
                    // Extract season from document or team (try multiple possible field names)
                    const season = doc.season || team.season || doc.Season || team.Season || 
                                   doc.season_name || team.season_name || doc.seasonName || team.seasonName ||
                                   doc.year || team.year || null;
                    
                    if (season) {
                        console.log(`   ✅ Found season: ${season}`);
                    } else {
                        console.log(`   ⚠️ No season found for team: ${sportName}`);
                    }
                    
                    // Group by sport and season (create unique key)
                    const rosterKey = season ? `${sportName}|||${season}` : sportName;
                    if (!rosterBySport[rosterKey]) {
                        rosterBySport[rosterKey] = {
                            sport: sportName,
                            season: season,
                            coaches: [],
                            players: []
                        };
                    }
                    
                    // Add coaches and players
                    rosterBySport[rosterKey].coaches.push(...coaches);
                    rosterBySport[rosterKey].players.push(...players);
                });
            } else if (doc.teams && Array.isArray(doc.teams)) {
                // Handle teams as array
                console.log(`   Found ${doc.teams.length} teams in document (array)`);
                doc.teams.forEach((team, teamIndex) => {
                    const sport = team.sport || team.sport_name || team.sportName || team.name || team.title || 'Unknown Sport';
                    console.log(`   Team ${teamIndex + 1}: ${sport}`);
                    
                    // Extract coaches from team
                    let coaches = [];
                    if (team.coaches) {
                        if (Array.isArray(team.coaches)) {
                            coaches = team.coaches.map(c => typeof c === 'string' ? { name: c } : c);
                        } else if (typeof team.coaches === 'string') {
                            coaches = [{ name: team.coaches }];
                        } else {
                            coaches = [team.coaches];
                        }
                    } else if (team.coach) {
                        if (Array.isArray(team.coach)) {
                            coaches = team.coach.map(c => typeof c === 'string' ? { name: c } : c);
                        } else if (typeof team.coach === 'string') {
                            coaches = [{ name: team.coach }];
                        } else {
                            coaches = [team.coach];
                        }
                    }
                    
                    // Extract players from team
                    let players = [];
                    if (team.players) {
                        if (Array.isArray(team.players)) {
                            players = team.players.map(p => {
                                if (typeof p === 'string') {
                                    return { name: p };
                                } else if (p && typeof p === 'object') {
                                    return {
                                        name: p.name || p.player_name || p.playerName || 'Unknown',
                                        number: p.number || p.jersey || p.jerseyNumber || null,
                                        position: p.position || p.pos || null,
                                        grade: p.grade || p.gradeLevel || null
                                    };
                                }
                                return { name: 'Unknown' };
                            });
                        } else if (typeof team.players === 'string') {
                            players = [{ name: team.players }];
                        } else {
                            players = [team.players];
                        }
                    } else if (team.roster && Array.isArray(team.roster)) {
                        players = team.roster.map(p => {
                            if (typeof p === 'string') {
                                return { name: p };
                            } else if (p && typeof p === 'object') {
                                return {
                                    name: p.name || p.player_name || p.playerName || 'Unknown',
                                    number: p.number || p.jersey || p.jerseyNumber || null,
                                    position: p.position || p.pos || null,
                                    grade: p.grade || p.gradeLevel || null
                                };
                            }
                            return { name: 'Unknown' };
                        });
                    }
                    
                    console.log(`      ${coaches.length} coaches, ${players.length} players`);
                    
                    // Extract season from document or team
                    const season = doc.season || team.season || null;
                    
                    // Group by sport and season (create unique key)
                    const rosterKey = season ? `${sport}|||${season}` : sport;
                    if (!rosterBySport[rosterKey]) {
                        rosterBySport[rosterKey] = {
                            sport: sport,
                            season: season,
                            coaches: [],
                            players: []
                        };
                    }
                    
                    // Add coaches and players
                    rosterBySport[rosterKey].coaches.push(...coaches);
                    rosterBySport[rosterKey].players.push(...players);
                });
            } else {
                // Handle flat document structure
                const sport = doc.sport || doc.sport_name || doc.sportName || doc.name || doc.title || 'Unknown Sport';
                // Try multiple possible field names for season
                const season = doc.season || doc.Season || doc.season_name || doc.seasonName || 
                              doc.year || null;
                console.log(`   Sport: ${sport}, Season: ${season || 'N/A'}`);
                console.log(`   Document keys: ${Object.keys(doc).join(', ')}`);
                
                // Extract coaches
                let coaches = [];
                if (doc.coaches) {
                    if (Array.isArray(doc.coaches)) {
                        coaches = doc.coaches.map(c => typeof c === 'string' ? { name: c } : c);
                    } else if (typeof doc.coaches === 'string') {
                        coaches = [{ name: doc.coaches }];
                    } else {
                        coaches = [doc.coaches];
                    }
                } else if (doc.coach) {
                    if (Array.isArray(doc.coach)) {
                        coaches = doc.coach.map(c => typeof c === 'string' ? { name: c } : c);
                    } else if (typeof doc.coach === 'string') {
                        coaches = [{ name: doc.coach }];
                    } else {
                        coaches = [doc.coach];
                    }
                }
                
                // Extract players
                let players = [];
                if (doc.players) {
                    if (Array.isArray(doc.players)) {
                        players = doc.players.map(p => {
                            if (typeof p === 'string') {
                                return { name: p };
                            } else if (p && typeof p === 'object') {
                                return {
                                    name: p.name || p.player_name || p.playerName || 'Unknown',
                                    number: p.number || p.jersey || p.jerseyNumber || null,
                                    position: p.position || p.pos || null,
                                    grade: p.grade || p.gradeLevel || null
                                };
                            }
                            return { name: 'Unknown' };
                        });
                    } else if (typeof doc.players === 'string') {
                        players = [{ name: doc.players }];
                    } else {
                        players = [doc.players];
                    }
                } else if (doc.roster && Array.isArray(doc.roster)) {
                    players = doc.roster.map(p => {
                        if (typeof p === 'string') {
                            return { name: p };
                        } else if (p && typeof p === 'object') {
                            return {
                                name: p.name || p.player_name || p.playerName || 'Unknown',
                                number: p.number || p.jersey || p.jerseyNumber || null,
                                position: p.position || p.pos || null,
                                grade: p.grade || p.gradeLevel || null
                            };
                        }
                        return { name: 'Unknown' };
                    });
                }
                
                console.log(`   Found ${coaches.length} coaches, ${players.length} players`);
                
                // Group by sport and season (create unique key) - season already extracted above
                const rosterKey = season ? `${sport}|||${season}` : sport;
                if (!rosterBySport[rosterKey]) {
                    rosterBySport[rosterKey] = {
                        sport: sport,
                        season: season,
                        coaches: [],
                        players: []
                    };
                }
                
                // Add coaches and players
                rosterBySport[rosterKey].coaches.push(...coaches);
                rosterBySport[rosterKey].players.push(...players);
            }
        });
        
        // Convert to array format
        const rosterArray = Object.values(rosterBySport).map(team => ({
            sport: team.sport,
            season: team.season || null,
            coaches: team.coaches || [],
            players: team.players || []
        }));
        
        console.log(`✅ Returning ${rosterArray.length} sports with roster data\n`);
        
        res.json(rosterArray);
    } catch (error) {
        console.error('❌ Error fetching team roster:', error);
        res.status(500).json({ error: 'Failed to fetch team roster', details: error.message });
    }
});

// Get all academic events
app.get('/api/academic', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }

        const collection = db.collection(ACADEMIC_COLLECTION_NAME);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 FETCHING ACADEMIC EVENTS FROM MONGODB:');
        console.log(`   Database: ${DATABASE_NAME}`);
        console.log(`   Collection: ${ACADEMIC_COLLECTION_NAME}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Fetch ALL documents with no filter
        const documents = await collection.find({}).toArray();
        
        console.log(`📊 Raw count from MongoDB: ${documents.length} documents`);
        
        // Log document structure for debugging
        if (documents.length > 0) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 DOCUMENT STRUCTURE (First Document):');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(JSON.stringify(documents[0], null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        
        // Extract events from documents
        let allEvents = [];
        
        documents.forEach((doc) => {
            // Check if document has events array (academic collection structure)
            if (doc.events && Array.isArray(doc.events)) {
                doc.events.forEach((eventItem, index) => {
                    // Academic events have: event, date, day, location, Category
                    let dateString = eventItem.date || new Date().toISOString();
                    
                    // Try to parse date (formats: "2026-01-16 to 01-18", "02-14 to 02-16", "2026-01-16", etc.)
                    try {
                        // First, try to extract date from range formats
                        // Format 1: "2026-01-16 to 01-18" or "2026-01-16 to 2026-01-18"
                        let dateMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (dateMatch) {
                            const parsedDate = new Date(dateMatch[1]);
                            if (!isNaN(parsedDate.getTime())) {
                                dateString = parsedDate.toISOString();
                            }
                        } else {
                            // Format 2: "02-14 to 02-16" or "01-23 to 01-25" (MM-DD format, assume current year)
                            dateMatch = dateString.match(/^(\d{2}-\d{2})/);
                            if (dateMatch) {
                                const currentYear = new Date().getFullYear();
                                const [month, day] = dateMatch[1].split('-');
                                const dateWithYear = `${currentYear}-${month}-${day}`;
                                const parsedDate = new Date(dateWithYear);
                                
                                // Check if date is in the past (more than 30 days ago), then use next year
                                const now = new Date();
                                const daysDiff = (parsedDate - now) / (1000 * 60 * 60 * 24);
                                
                                if (!isNaN(parsedDate.getTime())) {
                                    if (daysDiff < -30) {
                                        // Date is more than 30 days in the past, assume next year
                                        const nextYear = currentYear + 1;
                                        const dateWithNextYear = `${nextYear}-${month}-${day}`;
                                        const parsedDateNextYear = new Date(dateWithNextYear);
                                        if (!isNaN(parsedDateNextYear.getTime())) {
                                            dateString = parsedDateNextYear.toISOString();
                                        } else {
                                            dateString = parsedDate.toISOString();
                                        }
                                    } else {
                                        dateString = parsedDate.toISOString();
                                    }
                                } else {
                                    // Invalid date, try next year
                                    const nextYear = currentYear + 1;
                                    const dateWithNextYear = `${nextYear}-${month}-${day}`;
                                    const parsedDateNextYear = new Date(dateWithNextYear);
                                    if (!isNaN(parsedDateNextYear.getTime())) {
                                        dateString = parsedDateNextYear.toISOString();
                                    }
                                }
                            } else {
                                // Try parsing as-is
                                const parsedDate = new Date(dateString);
                                if (!isNaN(parsedDate.getTime())) {
                                    dateString = parsedDate.toISOString();
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not parse date: ${eventItem.date}, using current date`);
                    }
                    
                    allEvents.push({
                        _id: doc._id.toString() + '_' + index,
                        title: eventItem.event || eventItem.title || eventItem.name || 'Untitled Event',
                        date: dateString,
                        dateRange: eventItem.date || null, // Original date range string
                        dayRange: eventItem.day || null, // Day range (e.g., "Friday to Sunday")
                        location: eventItem.location || null,
                        category: eventItem.Category || eventItem.category || null,
                        link: eventItem.link || eventItem.url || eventItem.href || null
                    });
                });
            }
            // Check if document has articles array
            else if (doc.articles && Array.isArray(doc.articles)) {
                doc.articles.forEach((article, index) => {
                    let dateString = article.date || new Date().toISOString();
                    try {
                        const date = new Date(article.date);
                        if (!isNaN(date.getTime())) {
                            dateString = date.toISOString();
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not parse date: ${article.date}, using current date`);
                    }
                    
                    allEvents.push({
                        _id: doc._id.toString() + '_' + index,
                        title: article.title || 'Untitled Event',
                        date: dateString,
                        link: article.link || article.url || article.href || null
                    });
                });
            }
            // Check if document has upcoming_events array
            else if (doc.upcoming_events && Array.isArray(doc.upcoming_events)) {
                doc.upcoming_events.forEach((dateGroup) => {
                    if (dateGroup.events && Array.isArray(dateGroup.events)) {
                        dateGroup.events.forEach((event) => {
                            allEvents.push({
                                _id: doc._id.toString() + '_' + allEvents.length,
                                title: event.title || event.event || event.event_name || event.eventName || event.name || 'Untitled Event',
                                date: dateGroup.date || event.date || new Date().toISOString(),
                                link: event.link || event.url || event.href || null
                            });
                        });
                    } else {
                        allEvents.push({
                            _id: doc._id.toString() + '_' + allEvents.length,
                            title: dateGroup.title || dateGroup.event || dateGroup.event_name || dateGroup.eventName || dateGroup.name || 'Untitled Event',
                            date: dateGroup.date || new Date().toISOString(),
                            link: dateGroup.link || dateGroup.url || dateGroup.href || null
                        });
                    }
                });
            } else {
                // If document itself is an event (flat structure)
                if (doc.title || doc.name || doc.event || doc.event_name) {
                    allEvents.push({
                        _id: doc._id.toString(),
                        title: doc.title || doc.name || doc.event || doc.event_name || 'Untitled Event',
                        date: doc.date || new Date().toISOString(),
                        link: doc.link || doc.url || doc.href || null
                    });
                }
            }
        });
        
        console.log(`📊 Extracted ${allEvents.length} academic events from ${documents.length} document(s)`);
        
        // Sort by date (descending - most recent first, including past events)
        allEvents.sort((a, b) => {
            try {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA; // Descending: most recent first
            } catch (error) {
                console.log(`⚠️ Could not parse date for sorting. Event A: ${a.title}, Event B: ${b.title}`);
                return 0;
            }
        });
        
        console.log(`✅ Returning ${allEvents.length} academic events (including past events) to iOS app\n`);
        
        res.json(allEvents);
    } catch (error) {
        console.error('❌ Error fetching academic events:', error);
        res.status(500).json({ error: 'Failed to fetch academic events', details: error.message });
    }
});

// GET /api/result - Get all result events
app.get('/api/result', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const collection = db.collection(RESULT_COLLECTION_NAME);
        const documents = await collection.find({}).toArray();
        
        console.log(`\n📥 GET /api/result`);
        console.log(`   Collection: ${RESULT_COLLECTION_NAME}`);
        console.log(`   Found ${documents.length} document(s)`);
        
        let allResults = [];
        
        documents.forEach((doc) => {
            // Log document structure for debugging
            console.log(`📄 Document structure:`, JSON.stringify(Object.keys(doc), null, 2));
            
            // Check if document has events array (primary structure)
            if (doc.events && Array.isArray(doc.events)) {
                console.log(`   Found events array with ${doc.events.length} items`);
                doc.events.forEach((resultItem, index) => {
                    let dateString = resultItem.date || new Date().toISOString();
                    
                    // Try to parse date
                    try {
                        const dateMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (dateMatch) {
                            const parsedDate = new Date(dateMatch[1]);
                            if (!isNaN(parsedDate.getTime())) {
                                dateString = parsedDate.toISOString();
                            }
                        } else {
                            // Try MM-DD format
                            const dateMatch2 = dateString.match(/^(\d{2}-\d{2})/);
                            if (dateMatch2) {
                                const currentYear = new Date().getFullYear();
                                const [month, day] = dateMatch2[1].split('-');
                                const dateWithYear = `${currentYear}-${month}-${day}`;
                                const parsedDate = new Date(dateWithYear);
                                if (!isNaN(parsedDate.getTime())) {
                                    dateString = parsedDate.toISOString();
                                }
                            } else {
                                const parsedDate = new Date(dateString);
                                if (!isNaN(parsedDate.getTime())) {
                                    dateString = parsedDate.toISOString();
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not parse date: ${resultItem.date}, using current date`);
                    }
                    
                    allResults.push({
                        _id: doc._id.toString() + '_' + index,
                        sport: resultItem.sport || null,
                        season: resultItem.season || null,
                        date: dateString,
                        day: resultItem.day || null,
                        event: resultItem.event || resultItem.title || 'Untitled Result',
                        location: resultItem.location || null,
                        opponent: resultItem.opponent || null,
                        player: resultItem.player || null,
                        result: resultItem.result || null,
                        score: resultItem.score || null
                    });
                });
            } else if (doc.results && Array.isArray(doc.results)) {
                // Fallback: Check if document has results array (alternative structure)
                console.log(`   Found results array with ${doc.results.length} items`);
                doc.results.forEach((resultItem, index) => {
                    let dateString = resultItem.date || new Date().toISOString();
                    
                    // Try to parse date
                    try {
                        const dateMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (dateMatch) {
                            const parsedDate = new Date(dateMatch[1]);
                            if (!isNaN(parsedDate.getTime())) {
                                dateString = parsedDate.toISOString();
                            }
                        } else {
                            // Try MM-DD format
                            const dateMatch2 = dateString.match(/^(\d{2}-\d{2})/);
                            if (dateMatch2) {
                                const currentYear = new Date().getFullYear();
                                const [month, day] = dateMatch2[1].split('-');
                                const dateWithYear = `${currentYear}-${month}-${day}`;
                                const parsedDate = new Date(dateWithYear);
                                if (!isNaN(parsedDate.getTime())) {
                                    dateString = parsedDate.toISOString();
                                }
                            } else {
                                const parsedDate = new Date(dateString);
                                if (!isNaN(parsedDate.getTime())) {
                                    dateString = parsedDate.toISOString();
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not parse date: ${resultItem.date}, using current date`);
                    }
                    
                    allResults.push({
                        _id: doc._id.toString() + '_' + index,
                        sport: resultItem.sport || null,
                        season: resultItem.season || null,
                        date: dateString,
                        day: resultItem.day || null,
                        event: resultItem.event || resultItem.title || 'Untitled Result',
                        location: resultItem.location || null,
                        opponent: resultItem.opponent || null,
                        player: resultItem.player || null,
                        result: resultItem.result || null,
                        score: resultItem.score || null
                    });
                });
            } else {
                // If document itself is a result (flat structure)
                console.log(`   Checking flat structure - has event: ${!!doc.event}, has title: ${!!doc.title}, has sport: ${!!doc.sport}`);
                if (doc.event || doc.title || doc.sport) {
                    let dateString = doc.date || new Date().toISOString();
                    try {
                        const parsedDate = new Date(dateString);
                        if (!isNaN(parsedDate.getTime())) {
                            dateString = parsedDate.toISOString();
                        }
                    } catch (error) {
                        console.log(`⚠️ Could not parse date: ${doc.date}, using current date`);
                    }
                    
                    allResults.push({
                        _id: doc._id.toString(),
                        sport: doc.sport || null,
                        season: doc.season || null,
                        date: dateString,
                        day: doc.day || null,
                        event: doc.event || doc.title || 'Untitled Result',
                        location: doc.location || null,
                        opponent: doc.opponent || null,
                        player: doc.player || null,
                        result: doc.result || null,
                        score: doc.score || null
                    });
                }
            }
        });
        
        console.log(`📊 Extracted ${allResults.length} results from ${documents.length} document(s)`);
        
        // Sort by date (descending - most recent first)
        allResults.sort((a, b) => {
            try {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA; // Descending: most recent first
            } catch (error) {
                console.log(`⚠️ Could not parse date for sorting. Result A: ${a.event}, Result B: ${b.event}`);
                return 0;
            }
        });
        
        console.log(`✅ Returning ${allResults.length} results to iOS app\n`);
        
        res.json(allResults);
    } catch (error) {
        console.error('❌ Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results', details: error.message });
    }
});

// Start server
async function startServer() {
    await connectToMongoDB();
    
    app.listen(PORT, '0.0.0.0', () => {
        const host = process.env.PORT ? 'production' : 'localhost';
        console.log(`🚀 Backend API server running on http://${host}:${PORT}`);
        console.log(`📡 MongoDB: ${DATABASE_NAME}.${COLLECTION_NAME} & ${GENERAL_COLLECTION_NAME} & ${ROSTER_COLLECTION_NAME} & ${ACADEMIC_COLLECTION_NAME} & ${RESULT_COLLECTION_NAME}`);
        console.log(`\nAvailable endpoints:`);
        console.log(`  GET  /health - Health check`);
        console.log(`  GET  /api/sports - Get all sports events`);
        console.log(`  GET  /api/sports/:id - Get sports event by ID`);
        console.log(`  POST /api/sports - Create new sports event`);
        console.log(`  GET  /api/general - Get all general events`);
        console.log(`  GET  /api/academic - Get all academic events`);
        console.log(`  GET  /api/roster - Get team roster`);
        console.log(`  GET  /api/result - Get all results`);
    });
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    if (client) {
        await client.close();
        console.log('✅ MongoDB connection closed');
    }
    process.exit(0);
});
