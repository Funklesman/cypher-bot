const Redis = require('ioredis');
const crypto = require('crypto');

class ContentDeduplicator {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });

        // Cache TTL in seconds (24 hours)
        this.CACHE_TTL = 24 * 60 * 60;
        
        // Lower similarity thresholds to catch more duplicates
        this.similarityThresholds = {
            recent: 0.5,    // Last 6 hours (reduced from 0.6)
            medium: 0.55,   // 6-12 hours (reduced from 0.65)
            old: 0.6,       // 12-24 hours (reduced from 0.7)
            veryOld: 0.65   // > 24 hours (reduced from 0.75)
        };

        // Source priorities (lower number = higher priority)
        this.sourcePriority = {
            'CoinDesk': 1,
            'TheBlock': 1,
            'Decrypt': 2,
            'CryptoPotato': 3,
            'BitcoinMagazine': 2,
            'NewsAPI': 3
        };

        // Track recent topics in Redis
        this.RECENT_TOPICS_KEY = 'recent_topics';
        this.MAX_RECENT_TOPICS = 10;

        // Add crossposting keys
        this.CROSSPOST_KEY = 'crosspost:last';
        this.CROSSPOST_TTL = 24 * 60 * 60; // 24 hours
        
        // New: Add a global cache key for all articles
        this.GLOBAL_ARTICLES_KEY = 'global:articles';
        
        // New: Define important entity types for better matching
        this.entityTypes = ['company', 'cryptocurrency', 'product', 'regulator', 'person'];
    }

    /**
     * Generate a unique fingerprint for content
     */
    generateContentFingerprint(article) {
        // Combine title, description, and key terms
        const content = [
            article.title,
            article.description,
            article.keywords?.join(' ') || ''
        ].filter(Boolean).join(' ');
        
        // Normalize content
        const normalized = content
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[^\w\s]/g, '')
            .trim();
        
        // Generate hash
        return crypto.createHash('md5').update(normalized).digest('hex');
    }
    
    /**
     * New: Generate a semantic fingerprint focusing on entities
     */
    generateSemanticFingerprint(article) {
        // Extract important entities from title and description
        const entities = this.extractEntities(article.title + ' ' + (article.description || ''));
        
        // Sort entities to ensure consistent order
        entities.sort();
        
        // Join entities and generate a hash
        const entityString = entities.join('|');
        return crypto.createHash('md5').update(entityString).digest('hex');
    }
    
    /**
     * New: Extract important entities from text
     */
    extractEntities(text) {
        if (!text) return [];
        
        // Convert to lowercase and clean up
        const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Define patterns for important entities
        const patterns = {
            companies: [
                'blackrock', 'coinbase', 'binance', 'kraken', 'gemini', 'fidelity', 'grayscale',
                'microstrategy', 'square', 'paypal', 'robinhood', 'tether', 'circle', 'consensys',
                'bitgo', 'chainalysis', 'ledger', 'trezor', 'ftx', 'ethereum foundation'
            ],
            cryptocurrencies: [
                'bitcoin', 'btc', 'ethereum', 'eth', 'xrp', 'ripple', 'cardano', 'ada', 'solana', 'sol',
                'polkadot', 'dot', 'dogecoin', 'doge', 'bnb', 'avalanche', 'avax', 'tether', 'usdt',
                'usd coin', 'usdc', 'luna', 'terra', 'shiba inu', 'shib', 'litecoin', 'ltc'
            ],
            products: [
                'etp', 'etf', 'bitcoin etp', 'bitcoin etf', 'spot bitcoin', 'futures', 'wallet',
                'exchange', 'dex', 'defi', 'nft', 'dao', 'stablecoin', 'layer 2', 'l2', 'smart contract'
            ],
            regulators: [
                'sec', 'cftc', 'finra', 'irs', 'federal reserve', 'bis', 'fsb', 'fed', 'ecb', 'eu',
                'european', 'regulation', 'regulator', 'regulatory', 'law', 'legal', 'framework'
            ],
            locations: [
                'us', 'usa', 'america', 'europe', 'eu', 'uk', 'china', 'japan', 'singapore', 'korea',
                'india', 'global', 'international', 'worldwide'
            ]
        };
        
        // Extract entities that appear in the text
        const entities = [];
        
        for (const [category, categoryPatterns] of Object.entries(patterns)) {
            for (const pattern of categoryPatterns) {
                if (normalized.includes(pattern)) {
                    entities.push(`${category}:${pattern}`);
                }
            }
        }
        
        return entities;
    }

    /**
     * Extract key terms from content
     */
    extractKeyTerms(content) {
        if (!content) return [];
        
        // Remove special characters and convert to lowercase
        const cleanText = content.toLowerCase().replace(/[^\w\s]/g, ' ');
        
        // Split into words and filter
        const words = cleanText.split(/\s+/)
            .filter(word => word.length > 2); // Keep words longer than 2 chars
        
        // Remove common stopwords
        const stopwords = new Set([
            'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has',
            'been', 'were', 'are', 'they', 'their', 'said', 'says', 'will',
            'over', 'more', 'what', 'when', 'where', 'which', 'than', 'your',
            'about', 'was', 'its', 'is', 'are', 'any', 'can', 'all', 'but',
            'not', 'who', 'you', 'our', 'out', 'use', 'way', 'also', 'get'
        ]);
        
        return words.filter(word => !stopwords.has(word));
    }

    /**
     * Calculate similarity between two pieces of content
     */
    calculateSimilarity(content1, content2) {
        if (!content1 || !content2) return 0;

        // Normalize content
        const normalized1 = content1.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalized2 = content2.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

        // Get key terms
        const terms1 = this.extractKeyTerms(normalized1);
        const terms2 = this.extractKeyTerms(normalized2);
        
        if (terms1.length === 0 || terms2.length === 0) return 0;
        
        // Create sets for Jaccard similarity
        const set1 = new Set(terms1);
        const set2 = new Set(terms2);
        
        // Calculate intersection and union
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        // Calculate Jaccard similarity
        const jaccardSimilarity = intersection.size / union.size;
        
        // Calculate term frequency similarity
        const freq1 = this.calculateTermFrequency(terms1);
        const freq2 = this.calculateTermFrequency(terms2);
        const freqSimilarity = this.calculateFrequencySimilarity(freq1, freq2);
        
        // Calculate word sequence similarity
        const sequenceSimilarity = this.calculateSequenceSimilarity(terms1, terms2);

        // Calculate exact phrase matches
        const phraseMatchSimilarity = this.calculatePhraseMatchSimilarity(normalized1, normalized2);
        
        // Return weighted average of similarities with increased phrase match weight
        return (jaccardSimilarity * 0.2) + 
               (freqSimilarity * 0.2) + 
               (sequenceSimilarity * 0.2) + 
               (phraseMatchSimilarity * 0.4); // Increased from 0.3 to 0.4
    }
    
    /**
     * New: Calculate entity-based similarity
     */
    calculateEntitySimilarity(article1, article2) {
        const text1 = article1.title + ' ' + (article1.description || '');
        const text2 = article2.title + ' ' + (article2.description || '');
        
        const entities1 = this.extractEntities(text1);
        const entities2 = this.extractEntities(text2);
        
        if (entities1.length === 0 || entities2.length === 0) return 0;
        
        // Create sets
        const set1 = new Set(entities1);
        const set2 = new Set(entities2);
        
        // Calculate intersection and union
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }
    
    /**
     * New: Calculate title-specific similarity
     */
    calculateTitleSimilarity(title1, title2) {
        if (!title1 || !title2) return 0;
        
        // Normalize titles
        const normalized1 = title1.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalized2 = title2.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Extract terms
        const terms1 = this.extractKeyTerms(normalized1);
        const terms2 = this.extractKeyTerms(normalized2);
        
        if (terms1.length === 0 || terms2.length === 0) return 0;
        
        // Create sets
        const set1 = new Set(terms1);
        const set2 = new Set(terms2);
        
        // Calculate intersection and union
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }

    calculateTermFrequency(terms) {
        const freq = {};
        terms.forEach(term => {
            freq[term] = (freq[term] || 0) + 1;
        });
        return freq;
    }

    calculateFrequencySimilarity(freq1, freq2) {
        const allTerms = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        allTerms.forEach(term => {
            const f1 = freq1[term] || 0;
            const f2 = freq2[term] || 0;
            dotProduct += f1 * f2;
            norm1 += f1 * f1;
            norm2 += f2 * f2;
        });

        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    calculateSequenceSimilarity(terms1, terms2) {
        const len1 = terms1.length;
        const len2 = terms2.length;
        
        if (len1 === 0 || len2 === 0) return 0;
        
        // Create sequences of 2-3 consecutive terms
        const seq1_2 = this.createSequences(terms1, 2);
        const seq2_2 = this.createSequences(terms2, 2);
        const seq1_3 = this.createSequences(terms1, 3);
        const seq2_3 = this.createSequences(terms2, 3);
        
        // Calculate Jaccard similarity for both sequence lengths
        const sim2 = this.calculateSetSimilarity(seq1_2, seq2_2);
        const sim3 = this.calculateSetSimilarity(seq1_3, seq2_3);
        
        // Return weighted average
        return (sim2 * 0.6) + (sim3 * 0.4);
    }

    createSequences(terms, n) {
        const sequences = new Set();
        for (let i = 0; i <= terms.length - n; i++) {
            sequences.add(terms.slice(i, i + n).join(' '));
        }
        return sequences;
    }

    calculateSetSimilarity(set1, set2) {
        if (set1.size === 0 || set2.size === 0) return 0;
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }

    calculatePhraseMatchSimilarity(text1, text2) {
        const words1 = text1.split(' ');
        const words2 = text2.split(' ');
        
        let matchCount = 0;
        const minLength = Math.min(words1.length, words2.length);
        
        // Look for matching phrases of 3-4 words
        for (let phraseLength = 4; phraseLength >= 3; phraseLength--) {
            for (let i = 0; i <= words1.length - phraseLength; i++) {
                const phrase = words1.slice(i, i + phraseLength).join(' ');
                if (text2.includes(phrase)) {
                    matchCount += phraseLength;
                }
            }
        }
        
        return matchCount / (minLength * 2); // Normalize by average length
    }

    /**
     * Get similarity threshold based on time
     */
    getSimilarityThreshold(hoursAgo) {
        if (hoursAgo < 6) return this.similarityThresholds.recent;
        if (hoursAgo < 12) return this.similarityThresholds.medium;
        if (hoursAgo < 24) return this.similarityThresholds.old;
        return this.similarityThresholds.veryOld;
    }

    /**
     * Store content in Redis cache
     */
    async storeContent(article, content) {
        try {
            // Generate standard fingerprint
            const fingerprint = this.generateContentFingerprint(article);
            const key = `content:${fingerprint}`;
            
            // Store content data
            await this.redis.setex(
                key,
                this.CACHE_TTL,
                JSON.stringify({
                    title: article.title,
                    content: content,
                    source: article.source,
                    timestamp: Date.now(),
                    url: article.url,
                    topic: article.topic,
                    keywords: article.keywords || []
                })
            );
            
            // Store in source-specific set
            const sourceKey = `source:${article.source}`;
            await this.redis.sadd(sourceKey, fingerprint);
            await this.redis.expire(sourceKey, this.CACHE_TTL);
            
            // New: Store in global article set for cross-source comparison
            await this.redis.sadd(this.GLOBAL_ARTICLES_KEY, fingerprint);
            await this.redis.expire(this.GLOBAL_ARTICLES_KEY, this.CACHE_TTL);
            
            // New: Generate and store semantic fingerprint
            const semanticFingerprint = this.generateSemanticFingerprint(article);
            const semanticKey = `semantic:${semanticFingerprint}`;
            
            // Store reference to the content fingerprint
            await this.redis.setex(
                semanticKey,
                this.CACHE_TTL,
                fingerprint
            );

            // Update recent topics
            if (article.topic) {
                await this.addRecentTopic(article.topic);
            }
            
            // Log successful storage with new fingerprinting methods
            console.log(`Stored article "${article.title.substring(0, 40)}..." with fingerprints: 
            - Standard: ${fingerprint}
            - Semantic: ${semanticFingerprint}`);
            
            return true;
        } catch (error) {
            console.error('Error storing content in Redis:', error);
            return false;
        }
    }

    /**
     * Check if content is similar to cached content
     */
    async isSimilarToCached(article, content) {
        try {
            // Start with standard fingerprint check
            const fingerprint = this.generateContentFingerprint(article);
            
            // Check exact match first
            const exactMatch = await this.redis.get(`content:${fingerprint}`);
            if (exactMatch) {
                console.log('Found exact content match in cache');
                return true;
            }
            
            // New: Check semantic fingerprint
            const semanticFingerprint = this.generateSemanticFingerprint(article);
            const semanticMatch = await this.redis.get(`semantic:${semanticFingerprint}`);
            if (semanticMatch) {
                console.log('Found semantic match in cache');
                return true;
            }
            
            // New: Modified to check across ALL sources (not just same source)
            // Get all fingerprints from the global article set
            const allFingerprints = await this.redis.smembers(this.GLOBAL_ARTICLES_KEY);
            
            console.log(`Checking article against ${allFingerprints.length} cached articles`);
            
            // Track best match for debugging
            let bestSimilarity = 0;
            let bestMatchTitle = '';
            
            // Check each piece of content in cache
            for (const fp of allFingerprints) {
                const cachedContent = await this.redis.get(`content:${fp}`);
                if (!cachedContent) continue;
                
                try {
                    const cached = JSON.parse(cachedContent);
                    const hoursAgo = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
                    
                    // Calculate title similarity (weighted more heavily)
                    const titleSimilarity = this.calculateTitleSimilarity(article.title, cached.title);
                    
                    // Calculate entity similarity (new method)
                    const entitySimilarity = this.calculateEntitySimilarity(
                        {title: article.title, description: article.description},
                        {title: cached.title, description: cached.content}
                    );
                    
                    // Calculate regular content similarity 
                    const contentSimilarity = this.calculateSimilarity(content, cached.content);
                    
                    // Combined similarity score with heavier weight on title and entities
                    const similarity = (titleSimilarity * 0.4) + 
                                      (entitySimilarity * 0.3) + 
                                      (contentSimilarity * 0.3);
                    
                    // Track best match for debugging
                    if (similarity > bestSimilarity) {
                        bestSimilarity = similarity;
                        bestMatchTitle = cached.title;
                    }
                    
                    // Get appropriate threshold
                    const threshold = this.getSimilarityThreshold(hoursAgo);
                    
                    if (similarity > threshold) {
                        console.log(`Found similar content (${Math.round(similarity * 100)}% combined similarity)`);
                        console.log(`- Title similarity: ${Math.round(titleSimilarity * 100)}%`);
                        console.log(`- Entity similarity: ${Math.round(entitySimilarity * 100)}%`);
                        console.log(`- Content similarity: ${Math.round(contentSimilarity * 100)}%`);
                        console.log(`- Similar to: "${cached.title}"`);
                        return true;
                    }
                } catch (parseError) {
                    console.error(`Error parsing cached content: ${parseError.message}`);
                    continue;
                }
            }
            
            // Debug info about best non-matching content
            if (bestSimilarity > 0) {
                console.log(`Best non-matching content: "${bestMatchTitle}"`);
                console.log(`Similarity score: ${Math.round(bestSimilarity * 100)}% (below threshold)`);
            }
            
            return false;
        } catch (error) {
            console.error('Error checking content similarity:', error);
            return false;
        }
    }

    /**
     * Get recently posted topics from Redis
     */
    async getRecentlyPostedTopics(days = 2) {
        try {
            const recentTopics = await this.redis.lrange(this.RECENT_TOPICS_KEY, 0, -1);
            const topics = recentTopics.map(topic => JSON.parse(topic));
            
            // Extract keywords from all topics
            const keywordMap = new Map();
            topics.forEach(topic => {
                if (topic.keywords) {
                    topic.keywords.forEach(word => {
                        keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
                    });
                }
            });
            
            // Keep only significant keywords (appear more than once)
            const significantKeywords = Array.from(keywordMap.entries())
                .filter(([_, count]) => count > 0)
                .map(([word, _]) => word);
            
            return {
                topics: topics.map(t => t.name),
                keywords: significantKeywords
            };
        } catch (error) {
            console.error('Error getting recently posted topics:', error);
            return { topics: [], keywords: [] };
        }
    }

    /**
     * Add a topic to recent topics list
     */
    async addRecentTopic(topic) {
        try {
            const topicData = {
                name: topic.toLowerCase(),
                timestamp: Date.now(),
                keywords: this.extractKeyTerms(topic)
            };
            
            // Add to the beginning of the list
            await this.redis.lpush(this.RECENT_TOPICS_KEY, JSON.stringify(topicData));
            
            // Trim to max size
            await this.redis.ltrim(this.RECENT_TOPICS_KEY, 0, this.MAX_RECENT_TOPICS - 1);
            
            // Set expiration on the list
            await this.redis.expire(this.RECENT_TOPICS_KEY, this.CACHE_TTL);
        } catch (error) {
            console.error('Error adding recent topic:', error);
        }
    }

    /**
     * Calculate similarity with recent topics
     */
    async calculateTopicSimilarity(article) {
        try {
            const recentTopics = await this.getRecentlyPostedTopics();
            if (!article || !recentTopics) {
                return 0;
            }
            
            let similarityScore = 0;
            
            // Check for direct topic match
            if (article.topic) {
                const normalizedTopic = article.topic.toLowerCase();
                if (recentTopics.topics.includes(normalizedTopic)) {
                    similarityScore += 0.5; // 50% similarity just for topic match
                }
            }
            
            // Extract keywords from this article
            const titleWords = this.extractKeyTerms(article.title);
            const descWords = this.extractKeyTerms(article.description);
            const allKeywords = [...titleWords, ...descWords];
            
            // Count keyword matches
            let matchCount = 0;
            allKeywords.forEach(word => {
                if (recentTopics.keywords.includes(word.toLowerCase())) {
                    matchCount++;
                }
            });
            
            // Calculate keyword similarity (as a percentage of matching keywords)
            if (allKeywords.length > 0) {
                similarityScore += 0.5 * (matchCount / allKeywords.length);
            }
            
            // New: Check entities as well for better topic matching
            const entities = this.extractEntities(article.title + ' ' + (article.description || ''));
            const entityWords = entities.map(e => e.split(':')[1]); // Extract just the entity name
            
            // Count entity matches against keywords
            let entityMatchCount = 0;
            entityWords.forEach(entity => {
                if (recentTopics.keywords.includes(entity.toLowerCase())) {
                    entityMatchCount++;
                }
            });
            
            // Add entity similarity (with less weight than direct keyword matches)
            if (entityWords.length > 0) {
                similarityScore += 0.3 * (entityMatchCount / entityWords.length);
            }
            
            // Normalize final score to be between 0 and 1
            return Math.min(1, similarityScore);
        } catch (error) {
            console.error('Error calculating topic similarity:', error);
            return 0;
        }
    }

    /**
     * Group similar articles to avoid repetition
     */
    async clusterArticles(articles) {
        const clusters = [];
        
        for (const article of articles) {
            // Check if this article belongs to an existing cluster
            let foundCluster = false;
            
            for (const cluster of clusters) {
                // Enhanced clustering logic:
                // 1. Check topic match
                // 2. Check entity overlap
                // 3. Calculate title similarity
                // 4. Check for project name matches
                
                const reference = cluster[0]; // Use first article as reference
                
                // Check topic match
                const topicMatch = article.topic === reference.topic;
                
                // Check entity overlap
                const articleEntities = this.extractEntities(article.title + ' ' + (article.description || ''));
                const referenceEntities = this.extractEntities(reference.title + ' ' + (reference.description || ''));
                
                // Count overlapping entities
                const entityOverlap = articleEntities.filter(entity => 
                    referenceEntities.includes(entity)
                ).length;
                
                // Calculate title similarity
                const titleSimilarity = this.calculateTitleSimilarity(article.title, reference.title);
                
                // NEW: Extract project names (blockchain projects, protocols, companies)
                const articleProjectNames = this.extractProjectNames(article.title + ' ' + (article.description || ''));
                const referenceProjectNames = this.extractProjectNames(reference.title + ' ' + (reference.description || ''));
                
                // NEW: Check if they mention the same project
                const projectOverlap = articleProjectNames.filter(name => 
                    referenceProjectNames.includes(name)
                ).length;
                
                // NEW: Check for keywords that indicate major events for the same project
                // These typically get reported by multiple news outlets
                const articleEvents = this.extractEventKeywords(article.title + ' ' + (article.description || ''));
                const referenceEvents = this.extractEventKeywords(reference.title + ' ' + (reference.description || ''));
                
                const hasEventOverlap = articleEvents.some(event => referenceEvents.includes(event));
                
                // NEW: Stronger clustering criteria
                if (
                    // Same topic and at least one entity overlap
                    (topicMatch && entityOverlap >= 1) ||
                    // At least two entity overlaps
                    (entityOverlap >= 2) ||
                    // Title similarity over 50%
                    (titleSimilarity > 0.5) ||
                    // NEW: Same project name and similar event keywords
                    (projectOverlap > 0 && hasEventOverlap) ||
                    // NEW: Multiple same project names is a strong signal
                    (projectOverlap >= 2)
                ) {
                    cluster.push(article);
                    foundCluster = true;
                    break;
                }
            }
            
            // If no existing cluster fits, create a new one
            if (!foundCluster) {
                clusters.push([article]);
            }
        }
        
        return clusters;
    }
    
    /**
     * NEW: Extract blockchain project names from text
     */
    extractProjectNames(text) {
        if (!text) return [];
        
        // Normalize text
        const normalized = text.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // List of known blockchain projects, protocols, and relevant platforms
        const projects = [
            'bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot', 'avalanche', 'arbitrum',
            'optimism', 'polygon', 'bnb chain', 'binance', 'tron', 'cosmos', 'ripple', 'xrp',
            'celo', 'near', 'flow', 'algorand', 'tezos', 'chainlink', 'uniswap', 'aave',
            'compound', 'maker', 'sushiswap', 'curve', 'yearn', 'synthetix', '1inch',
            'balancer', 'pancakeswap', 'opensea', 'metamask', 'lens', 'starknet', 'zkSync',
            'scroll', 'base', 'ronin', 'aptos', 'sui', 'mina', 'kaspa', 'dfinity',
            'internet computer', 'filecoin', 'arweave', 'the graph', 'chain', 'unstoppable domains',
            'ens', 'worldcoin', 'stellar', 'quant', 'hedera', 'eos'
        ];
        
        // Extract project names from text
        return projects.filter(project => normalized.includes(project));
    }
    
    /**
     * NEW: Extract event keywords that indicate major happenings 
     */
    extractEventKeywords(text) {
        if (!text) return [];
        
        // Normalize text
        const normalized = text.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Event types that indicate major news
        const eventKeywords = [
            'launch', 'migrate', 'migration', 'upgrade', 'transition', 'move to', 'moving to',
            'release', 'announce', 'partnership', 'integration', 'collaboration', 'airdrop',
            'token', 'mainnet', 'testnet', 'fork', 'update', 'vulnerability', 'exploit', 'hack',
            'security', 'protocol', 'governance', 'proposal', 'vote', 'acquisition', 'funding',
            'investment', 'layer 2', 'l2', 'scaling', 'zkrollup', 'optimistic rollup', 'sidechain',
            'hard fork'
        ];
        
        // Extract events mentioned in text
        return eventKeywords.filter(event => normalized.includes(event));
    }

    /**
     * Check if content has been crossposted recently
     */
    async hasBeenCrossposted(content) {
        try {
            const lastCrosspost = await this.redis.get(this.CROSSPOST_KEY);
            if (!lastCrosspost) return false;

            const { content: lastContent, timestamp } = JSON.parse(lastCrosspost);
            const hoursAgo = (Date.now() - timestamp) / (1000 * 60 * 60);

            // If it's been more than 24 hours, consider it not crossposted
            if (hoursAgo > 24) return false;

            // Check content similarity
            const similarity = this.calculateSimilarity(content, lastContent);
            return similarity > this.similarityThresholds.recent;
        } catch (error) {
            console.error('Error checking crosspost history:', error);
            return false;
        }
    }

    /**
     * Mark content as crossposted
     */
    async markAsCrossposted(content) {
        try {
            await this.redis.setex(
                this.CROSSPOST_KEY,
                this.CROSSPOST_TTL,
                JSON.stringify({
                    content,
                    timestamp: Date.now()
                })
            );
            return true;
        } catch (error) {
            console.error('Error marking content as crossposted:', error);
            return false;
        }
    }

    /**
     * Get last crossposted content
     */
    async getLastCrosspostedContent() {
        try {
            const lastCrosspost = await this.redis.get(this.CROSSPOST_KEY);
            if (!lastCrosspost) return null;

            const { content, timestamp } = JSON.parse(lastCrosspost);
            return {
                content,
                timestamp,
                hoursAgo: (Date.now() - timestamp) / (1000 * 60 * 60)
            };
        } catch (error) {
            console.error('Error getting last crossposted content:', error);
            return null;
        }
    }

    /**
     * Clean up old content from cache
     */
    async cleanup() {
        try {
            // Get all content keys
            const keys = await this.redis.keys('content:*');
            
            // Check each key's TTL
            for (const key of keys) {
                const ttl = await this.redis.ttl(key);
                if (ttl <= 0) {
                    await this.redis.del(key);
                }
            }
            
            // Clean up source sets
            const sourceKeys = await this.redis.keys('source:*');
            for (const key of sourceKeys) {
                const ttl = await this.redis.ttl(key);
                if (ttl <= 0) {
                    await this.redis.del(key);
                }
            }
            
            // Clean up semantic keys
            const semanticKeys = await this.redis.keys('semantic:*');
            for (const key of semanticKeys) {
                const ttl = await this.redis.ttl(key);
                if (ttl <= 0) {
                    await this.redis.del(key);
                }
            }

            // Clean up global articles key
            const globalTTL = await this.redis.ttl(this.GLOBAL_ARTICLES_KEY);
            if (globalTTL <= 0) {
                await this.redis.del(this.GLOBAL_ARTICLES_KEY);
            }

            // Clean up recent topics if expired
            const topicsTTL = await this.redis.ttl(this.RECENT_TOPICS_KEY);
            if (topicsTTL <= 0) {
                await this.redis.del(this.RECENT_TOPICS_KEY);
            }

            // Clean up crosspost data if expired
            const crosspostTTL = await this.redis.ttl(this.CROSSPOST_KEY);
            if (crosspostTTL <= 0) {
                await this.redis.del(this.CROSSPOST_KEY);
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    async close() {
        try {
            if (this.redis) {
                await this.redis.quit();
                // Remove the Redis instance
                this.redis = null;
            }
        } catch (error) {
            console.error('Error closing Redis connection:', error);
            throw error;
        }
    }
}

module.exports = ContentDeduplicator; 