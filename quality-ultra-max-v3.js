/**
 * Quality Ultra-Max v3.0.0
 * نظام تحليل شامل لجودة مقالات ويكيبيديا العربية
 * 
 * @author Quality Ultra-Max Team
 * @version 3.0.0
 * @license MIT
 * @description
 * نظام متطور لتقييم جودة المقالات بناءً على معايير متعددة:
 * - البنية واللغة (30%)
 * - المصادر والمراجع (25%)
 * - الصيانة (20%)
 * - الروابط (15%)
 * - الوسائط (10%)
 * 
 * Built: 2025-11-24T07:49:39.388Z
 */

(function(window, $, mw) {
   'use strict';

   // إنشاء namespace رئيسي
   window.QualityUltraMax = window.QualityUltraMax || {};
   
   console.log('[QUM] Loading Quality Ultra-Max v3.0.0...');

   // ========================================
   // Module: core/dataFetcher.js
   // ========================================

   'use strict';
   
      class DataFetcher {
         constructor() {
            this.api = new mw.Api();
            this.cache = new Map();
         }
   
         /**
          * جلب المقدمة (القسم 0) بشكل منفصل
          * @param {string} pageTitle 
          * @returns {Promise<string>}
          */
         async fetchIntro(pageTitle) {
            const cacheKey = `intro_${pageTitle}`;
            if (this.cache.has(cacheKey)) {
               return this.cache.get(cacheKey);
            }
   
            try {
               const result = await this.api.get({
                  action: 'parse',
                  page: pageTitle,
                  prop: 'wikitext',
                  section: 0,
                  formatversion: 2
               });
   
               const wikitext = result?.parse?.wikitext || '';
               this.cache.set(cacheKey, wikitext);
               return wikitext;
            } catch (error) {
               console.warn('فشل جلب المقدمة:', error);
               return '';
            }
         }
   
         /**
          * جلب الصفحة الكاملة المحللة
          * @param {string} pageTitle 
          * @returns {Promise<Object>}
          */
         async fetchFullPage(pageTitle) {
            const cacheKey = `full_${pageTitle}`;
            if (this.cache.has(cacheKey)) {
               return this.cache.get(cacheKey);
            }
   
            try {
               const result = await this.api.get({
                  action: 'parse',
                  page: pageTitle,
                  prop: 'text|wikitext|sections|images|externallinks|categories|templates',
                  disablelimitreport: 1,
                  disableeditsection: 1,
                  disabletoc: 1,
                  formatversion: 2
               });
   
               const parsed = result?.parse || null;
               this.cache.set(cacheKey, parsed);
               return parsed;
            } catch (error) {
               console.error('فشل جلب الصفحة الكاملة:', error);
               return null;
            }
         }
   
         /**
          * جلب قواعد الأخطاء النحوية
          * @returns {Promise<Array>}
          */
         async fetchGrammarRules() {
            const cacheKey = 'grammar_rules';
            if (this.cache.has(cacheKey)) {
               return this.cache.get(cacheKey);
            }
   
            try {
               const result = await this.api.get({
                  action: 'query',
                  prop: 'revisions',
                  titles: 'MediaWiki:Ar_gram_errors.json',
                  rvprop: 'content',
                  rvslots: 'main',
                  formatversion: 2
               });
   
               const page = result?.query?.pages?.[0];
               if (!page || page.missing || !page.revisions?.[0]) {
                  return this.getDefaultGrammarRules();
               }
   
               const content = page.revisions[0].slots.main.content;
               const rules = JSON.parse(content);
               
               const processedRules = rules.map(rule => ({
                  pattern: new RegExp(rule.pattern, rule.flags || 'g'),
                  description: rule.description || '',
                  suggestion: rule.suggestion || ''
               }));
   
               this.cache.set(cacheKey, processedRules);
               return processedRules;
            } catch (error) {
               console.warn('فشل جلب قواعد النحو:', error);
               return this.getDefaultGrammarRules();
            }
         }
   
         /**
          * جلب جميع البيانات المطلوبة بشكل متوازي
          * @param {string} pageTitle 
          * @returns {Promise<Object>}
          */
         async fetchAll(pageTitle) {
            try {
               const [introWikitext, fullParse, grammarRules] = await Promise.all([
                  this.fetchIntro(pageTitle),
                  this.fetchFullPage(pageTitle),
                  this.fetchGrammarRules()
               ]);
   
               if (!fullParse) {
                  throw new Error('فشل في جلب بيانات المقالة');
               }
   
               return {
                  pageTitle,
                  introWikitext,
                  fullParse,
                  grammarRules,
                  fetchedAt: Date.now()
               };
            } catch (error) {
               console.error('خطأ في fetchAll:', error);
               throw error;
            }
         }
   
         /**
          * قواعد نحوية افتراضية
          * @returns {Array}
          */
         getDefaultGrammarRules() {
            return [
               { pattern: /هاذا/g, description: 'خطأ إملائي: هاذا → هذا' },
               { pattern: /هاذه/g, description: 'خطأ إملائي: هاذه → هذه' },
               { pattern: /ذالك/g, description: 'خطأ إملائي: ذالك → ذلك' },
               { pattern: /لذالك/g, description: 'خطأ إملائي: لذالك → لذلك' },
               { pattern: /مسؤلية/g, description: 'خطأ إملائي: مسؤلية → مسؤولية' },
               { pattern: /إست(?!ان|قبل)/g, description: 'خطأ إملائي: إست → است' },
               { pattern: /\sالى\s/g, description: 'خطأ إملائي: الى → إلى' },
               { pattern: /حفض/g, description: 'خطأ إملائي: حفض → حفظ' },
               { pattern: /معضم/g, description: 'خطأ إملائي: معضم → معظم' },
               { pattern: /كده|كدا|كدة/g, description: 'تعبير عامي' },
               { pattern: /علشان|عشان/g, description: 'تعبير عامي' },
               { pattern: /جداً جداً/g, description: 'حشو لغوي' },
               { pattern: /هو كان|كانت هي/g, description: 'ترجمة آلية ركيكة' },
               { pattern: / ,/g, description: 'ترقيم خاطئ: مسافة قبل الفاصلة' },
               { pattern: /!!/g, description: 'ترقيم زائد' }
            ];
         }
   
         /**
          * مسح الذاكرة المؤقتة
          */
         clearCache() {
            this.cache.clear();
         }
      }
   
      // تصدير للاستخدام العام
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.DataFetcher = DataFetcher;

   // ========================================
   // Module: core/articleModel.js
   // ========================================

   'use strict';
   
      class UnifiedArticleModel {
         constructor(rawData) {
            this.title = rawData.pageTitle;
            this.introWikitext = rawData.introWikitext;
            this.html = rawData.fullParse.text || '';
            this.wikitext = rawData.fullParse.wikitext || '';
            this.sections = rawData.fullParse.sections || [];
            this.images = rawData.fullParse.images || [];
            this.externallinks = rawData.fullParse.externallinks || [];
            this.categories = (rawData.fullParse.categories || []).map(c => c.category);
            this.templates = (rawData.fullParse.templates || []).map(t => t.title);
            this.grammarRules = rawData.grammarRules || [];
            
            // إنشاء DOM محلل
            this.$parsedContent = this._normalizeContent(this.html);
            
            // استخراج عناصر DOM المهمة
            this._extractDOMElements();
            
            // تنظيف النص
            this.cleanIntroText = this._extractCleanIntro();
            this.fullText = this.$parsedContent.text();
            this.articleLength = this.fullText.trim().length;
         }
   
         /**
          * تطبيع المحتوى وتغليفه في .mw-parser-output
          * @private
          */
         _normalizeContent(html) {
            if (!html) {
               return $('<div class="mw-parser-output"></div>');
            }
   
            const $temp = $('<div>').html(html);
            let $content = $temp.find('.mw-parser-output').first();
   
            if (!$content.length) {
               $content = $('<div class="mw-parser-output"></div>').html(html);
            }
   
            return $content;
         }
   
         /**
          * استخراج عناصر DOM المهمة
          * @private
          */
         _extractDOMElements() {
            // صندوق المعلومات
            this.$infobox = this.$parsedContent.find('.infobox').first();
            
            // محتوى المقالة النظيف (بدون عناصر جانبية)
            this.$articleBody = this._getCleanArticleBody();
            
            // قسم المراجع
            this.$referencesSection = this.$parsedContent.find('ol.references');
         }
   
         /**
          * الحصول على محتوى المقالة النظيف
          * @private
          */
         _getCleanArticleBody() {
            const $clone = this.$parsedContent.clone();
            
            // إزالة العناصر غير المقالية
            $clone.find(`
               .infobox,
               .navbox,
               .vertical-navbox,
               .sidebar,
               .sistersitebox,
               .mbox-small,
               .metadata,
               .ambox,
               .tmbox,
               .catlinks,
               .noprint,
               .mw-authority-control,
               .navbox-styles,
               table[role="navigation"],
               table[role="presentation"],
               .toc,
               .hatnote,
               .dablink,
               .reflist,
               #coordinates
            `).remove();
   
            // إزالة المحتوى بعد قسم المراجع
            const $refsHeading = $clone.find('h2').filter(function() {
               const text = $(this).text();
               return /مراجع|references|مصادر|ملاحظات|الهوامش|وصلات خارجية|external links/i.test(text);
            }).first();
   
            if ($refsHeading.length > 0) {
               $refsHeading.nextAll().remove();
               $refsHeading.remove();
            }
   
            return $clone;
         }
   
         /**
          * استخراج نص المقدمة النظيف
          * @private
          */
         _extractCleanIntro() {
            if (this.introWikitext) {
               let text = this.introWikitext;
   
               // إزالة التعليقات
               text = text.replace(/<!--[\s\S]*?-->/g, '');
   
               // إزالة القوالب بشكل تكراري
               let prevText = '';
               while (prevText !== text) {
                  prevText = text;
                  text = text.replace(/\{\{[^{}]*\}\}/g, '');
               }
   
               // إزالة الروابط الخارجية
               text = text.replace(/\[https?:\/\/[^\]]+\]/g, '');
   
               // إزالة الروابط الداخلية والحفاظ على النص
               text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
   
               // إزالة المراجع
               text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
               text = text.replace(/<ref[^>]*\/>/gi, '');
   
               // إزالة وسوم HTML
               text = text.replace(/<[^>]+>/g, '');
   
               // إزالة التنسيقات
               text = text.replace(/'{2,5}([^']+)'{2,5}/g, '$1');
   
               // إزالة أوامر خاصة
               text = text.replace(/__[A-Z]+__/g, '');
   
               // تنظيف المسافات
               text = text.replace(/\s+/g, ' ').trim();
   
               return text;
            }
   
            // احتياطي
            return this.$parsedContent.find('p').first().text().trim();
         }
   
         /**
          * الحصول على عدد الكلمات
          */
         getWordCount() {
            return this.fullText.trim().split(/\s+/).length;
         }
   
         /**
          * الحصول على قائمة الروابط الداخلية
          */
         getInternalLinks() {
            const links = [];
            
            this.$articleBody.find('a').each(function() {
               const href = $(this).attr('href');
               if (!href) return;
               
               const isWikiLink = href.startsWith('/wiki/') || 
                                 href.startsWith('./') || 
                                 href.includes('/w/index.php?title=');
               
               if (isWikiLink && !$(this).hasClass('new')) {
                  if (!href.includes(':') || 
                      !href.match(/\/(ملف|صورة|File|Image|تصنيف|Category|ويكيبيديا|Wikipedia|قالب|Template|مساعدة|Help|بوابة|Portal):/i)) {
                     links.push(href);
                  }
               }
            });
   
            return [...new Set(links)];
         }
   
         /**
          * الحصول على قائمة الروابط الحمراء
          */
         getRedLinks() {
            const redLinks = [];
            
            this.$articleBody.find('a.new').each(function() {
               redLinks.push($(this).attr('href'));
            });
   
            return redLinks;
         }
   
         /**
          * كشف نوع المقالة
          */
         detectArticleType() {
            const types = [];
   
            // طبية
            const medicalKeywords = ['طب', 'طبي', 'مرض', 'علاج', 'دواء', 'جراحة'];
            if (medicalKeywords.some(k => this.fullText.includes(k))) {
               types.push('medical');
            }
   
            // جغرافية
            if (this.$infobox.length && this.$infobox.text().includes('إحداثيات')) {
               types.push('geographic');
            }
   
            // سيرة ذاتية
            const bioTemplates = this.templates.filter(t => 
               /صندوق معلومات شخص|معلومات شخصية|Infobox person/i.test(t)
            );
            if (bioTemplates.length > 0) {
               types.push('biography');
            }
   
            return types;
         }
   
         /**
          * تصدير كـ JSON
          */
         toJSON() {
            return {
               title: this.title,
               articleLength: this.articleLength,
               wordCount: this.getWordCount(),
               sectionsCount: this.sections.length,
               imagesCount: this.images.length,
               categoriesCount: this.categories.length,
               types: this.detectArticleType()
            };
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.UnifiedArticleModel = UnifiedArticleModel;

   // ========================================
   // Module: core/scoringEngine.js
   // ========================================

   'use strict';
   
      class ScoringEngine {
         constructor() {
            // الأوزان القياسية
            this.weights = {
               structure: 0.25,    // 25%
               references: 0.25,   // 25%
               maintenance: 0.15,  // 15%
               links: 0.15,        // 15%
               media: 0.10,        // 10%
               language: 0.10      // 10% - التحليل اللغوي
            };
   
            // مستويات الجودة
            this.qualityLevels = [
               { min: 90, label: '💎 مقالة مميزة', class: 'featured' },
               { min: 80, label: '🌟 مقالة جيدة', class: 'good' },
               { min: 65, label: '✅ مقالة متقدمة', class: 'advanced' },
               { min: 50, label: '⚠️ مقالة بداية', class: 'start' },
               { min: 30, label: '📝 بذرية متطورة', class: 'stub-plus' },
               { min: 0, label: '🚨 بذرة', class: 'stub' }
            ];
         }
   
         /**
          * حساب النقاط النهائية
          * @param {Object} analysisResults - نتائج جميع المحللات
          * @returns {Object}
          */
         calculateFinalScore(analysisResults) {
            const {
               structureAnalysis,
               referenceAnalysis,
               mediaAnalysis,
               linkAnalysis,
               grammarAnalysis,
               maintenanceAnalysis,
               languageAnalysis
            } = analysisResults;
   
            // حساب نقاط التحليل اللغوي
            const languageScore = languageAnalysis ? this._calculateLanguageScore(languageAnalysis) : 10;
   
            // حساب نقاط المراجع مع المعايير المتقدمة
            const referencesScore = this._calculateReferencesScore(referenceAnalysis);
   
            // حساب نقاط الوسائط مع المعايير المتقدمة
            const mediaScore = this._calculateMediaScore(mediaAnalysis);
   
            // حساب النقاط الموزونة
            const scores = {
               structure: this._normalizeScore(structureAnalysis.score, 25),
               references: this._normalizeScore(referencesScore, 25),
               maintenance: this._normalizeScore(maintenanceAnalysis.score, 15),
               links: this._normalizeScore(linkAnalysis.score, 15),
               media: this._normalizeScore(mediaScore, 10),
               language: this._normalizeScore(languageScore, 10)
            };
   
            // المجموع النهائي
            const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
            const normalizedTotal = this._clamp(Math.round(total), 0, 100);
   
            // تحديد مستوى الجودة
            const qualityLevel = this._getQualityLevel(normalizedTotal);
   
            // جمع جميع الملاحظات
            const allNotes = this._collectNotes(analysisResults);
   
            return {
               total: normalizedTotal,
               level: qualityLevel.label,
               levelClass: qualityLevel.class,
               scores: scores,
               details: {
                  structure: structureAnalysis,
                  references: referenceAnalysis,
                  media: mediaAnalysis,
                  links: linkAnalysis,
                  grammar: grammarAnalysis,
                  maintenance: maintenanceAnalysis,
                  language: languageAnalysis
               },
               notes: allNotes,
               timestamp: Date.now()
            };
         }
   
         /**
          * تطبيع النقاط إلى الحد الأقصى المطلوب
          * @private
          */
         _normalizeScore(score, maxScore) {
            return this._clamp(score, 0, maxScore);
         }
   
         /**
          * تقييد القيمة ضمن نطاق
          * @private
          */
         _clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
         }
   
         /**
          * تحديد مستوى الجودة بناءً على النقاط
          * @private
          */
         _getQualityLevel(score) {
            for (const level of this.qualityLevels) {
               if (score >= level.min) {
                  return level;
               }
            }
            return this.qualityLevels[this.qualityLevels.length - 1];
         }
   
         /**
          * جمع جميع الملاحظات من المحللات
          * @private
          */
         _collectNotes(analysisResults) {
            const notes = [];
   
            // ملاحظات البنية
            if (analysisResults.structureAnalysis.notes) {
               notes.push(...analysisResults.structureAnalysis.notes);
            }
   
            // ملاحظات المراجع
            if (analysisResults.referenceAnalysis.notes) {
               notes.push(...analysisResults.referenceAnalysis.notes);
            }
   
            // ملاحظات الوسائط
            if (analysisResults.mediaAnalysis.notes) {
               notes.push(...analysisResults.mediaAnalysis.notes);
            }
   
            // ملاحظات الروابط
            if (analysisResults.linkAnalysis.notes) {
               notes.push(...analysisResults.linkAnalysis.notes);
            }
   
            // ملاحظات اللغة
            if (analysisResults.grammarAnalysis.notes) {
               notes.push(...analysisResults.grammarAnalysis.notes);
            }
   
            // ملاحظات الصيانة
            if (analysisResults.maintenanceAnalysis.notes) {
               notes.push(...analysisResults.maintenanceAnalysis.notes);
            }
   
            // ملاحظات التحليل اللغوي
            if (analysisResults.languageAnalysis && analysisResults.languageAnalysis.notes) {
               notes.push(...analysisResults.languageAnalysis.notes);
            }
   
            return notes;
         }
   
         /**
          * حساب نقاط التحليل اللغوي
          * @private
          */
         _calculateLanguageScore(languageAnalysis) {
            let score = 10; // النقاط الكاملة
   
            // خصم نقاط على أنماط الترجمة الآلية
            if (languageAnalysis.machineTranslationSignals > 0) {
               const mtPenalty = Math.min(languageAnalysis.machineTranslationSignals * 0.1, 2);
               score -= mtPenalty;
            }
   
            // خصم نقاط على الأسلوب الضعيف
            if (languageAnalysis.weakStyleSignals > 0) {
               const stylePenalty = Math.min(languageAnalysis.weakStyleSignals * 0.1, 2);
               score -= stylePenalty;
            }
   
            // خصم نقاط على الأخطاء النحوية
            if (languageAnalysis.grammarViolations > 0) {
               const grammarPenalty = Math.min(languageAnalysis.grammarViolations * 0.15, 2);
               score -= grammarPenalty;
            }
   
            // خصم على الجمل الطويلة جداً
            if (languageAnalysis.longSentences > 5) {
               const longSentencePenalty = Math.min((languageAnalysis.longSentences - 5) * 0.2, 1.5);
               score -= longSentencePenalty;
            }
   
            // خصم على الفقرات الضعيفة
            if (languageAnalysis.emptyParagraphs > 2) {
               const emptyParaPenalty = Math.min((languageAnalysis.emptyParagraphs - 2) * 0.3, 1);
               score -= emptyParaPenalty;
            }
   
            // خصم على كثرة كلمات الحشو
            if (languageAnalysis.fillerWordsCount > 10) {
               const fillerPenalty = Math.min((languageAnalysis.fillerWordsCount - 10) * 0.05, 1);
               score -= fillerPenalty;
            }
   
            // خصم على الجمل التي تبدأ بحروف الجر
            if (languageAnalysis.prepositionStartSentences > 0) {
               const prepPenalty = Math.min(languageAnalysis.prepositionStartSentences * 0.08, 1.5);
               score -= prepPenalty;
            }
   
            // خصم على ضعف السرد
            if (languageAnalysis.narrativeWeaknessSignals > 0) {
               const narrativePenalty = Math.min(languageAnalysis.narrativeWeaknessSignals * 0.12, 1.5);
               score -= narrativePenalty;
            }
   
            // خصم على التكرار والتشابه
            if (languageAnalysis.redundantSentences > 0) {
               const redundancyPenalty = Math.min(languageAnalysis.redundantSentences * 0.25, 2);
               score -= redundancyPenalty;
            }
   
            // مكافأة على جودة علامات الترقيم
            if (languageAnalysis.punctuationScore > 70) {
               score += 0.5;
            }
   
            return Math.max(0, Math.min(10, score));
         }
   
         /**
          * حساب نقاط المراجع مع المعايير المتقدمة
          * @private
          */
         _calculateReferencesScore(referenceAnalysis) {
            // البدء بالنقاط الأساسية من المحلل
            let score = referenceAnalysis.score;
   
            const details = referenceAnalysis.details;
   
            // 1) خصم إضافي على المراجع الناقصة
            if (details.incompleteReferencesCount > 0) {
               const incompletePenalty = Math.min(details.incompleteReferencesCount * 0.15, 2);
               score -= incompletePenalty;
            }
   
            // 2) مكافأة على المصادر القوية (كتب ودوريات)
            if (details.referenceTypes) {
               const bookBonus = Math.min(details.referenceTypes.book * 0.2, 1);
               const journalBonus = Math.min(details.referenceTypes.journal * 0.2, 1);
               score += bookBonus + journalBonus;
            }
   
            // 3) خصم إذا كانت مواقع الويب تسيطر على المصادر
            if (details.referenceTypes) {
               const web = details.referenceTypes.web || 0;
               const book = details.referenceTypes.book || 0;
               const journal = details.referenceTypes.journal || 0;
               const news = details.referenceTypes.news || 0;
   
               if (web > (book + journal + news)) {
                  score -= 0.5;
               }
            }
   
            // 4) مكافأة على استخدام استشهادات ويكي بيانات
            if (details.wikidataCitationsCount > 0) {
               const wikidataBonus = Math.min(0.25 * details.wikidataCitationsCount, 1);
               score += wikidataBonus;
            }
   
            // 5) خصم/مكافأة حسب فئة عدد المراجع
            if (details.referenceCountCategory) {
               switch (details.referenceCountCategory) {
                  case 'under10':
                     score -= 2;
                     break;
                  case 'between10and20':
                     score -= 1;
                     break;
                  case 'between20and50':
                     // لا خصم ولا مكافأة
                     break;
                  case 'above50':
                     score += 0.5;
                     break;
               }
            }
   
            // 6) مكافأة على التنوع اللغوي في المصادر
            if (details.referenceLanguages) {
               const ar = details.referenceLanguages.ar || 0;
               const en = details.referenceLanguages.en || 0;
               const other = details.referenceLanguages.other || 0;
   
               // إذا كان هناك مصادر بلغتين على الأقل
               const languagesUsed = (ar > 0 ? 1 : 0) + (en > 0 ? 1 : 0) + (other > 0 ? 1 : 0);
               if (languagesUsed >= 2) {
                  score += 0.5;
               }
            }
   
            // التأكد من بقاء النقاط في النطاق المقبول
            return Math.max(0, Math.min(25, score));
         }
   
         /**
          * حساب نقاط الوسائط مع المعايير المتقدمة
          * @private
          */
         _calculateMediaScore(mediaAnalysis) {
            let score = 0;
            const details = mediaAnalysis.details;
   
            // 1) النقاط الأساسية بناءً على الصور الإعلامية وصندوق المعلومات (0-7)
            const informativeImages = details.informativeImages || 0;
            const infoboxImages = details.infoboxImages || 0;
   
            if (informativeImages >= 5) {
               score += 5;
            } else if (informativeImages >= 3) {
               score += 4;
            } else if (informativeImages >= 1) {
               score += 3;
            }
   
            // مكافأة على صور صندوق المعلومات
            if (infoboxImages > 0) {
               score += 2;
            }
   
            // 2) مكافأة على الوسائط المتعددة (فيديو أو صوت)
            if ((details.videos || 0) > 0 || (details.audios || 0) > 0) {
               score += 1;
            }
   
            // 3) مكافأة على كثافة الوسائط المناسبة
            const mediaDensity = parseFloat(details.mediaDensity) || 0;
            const correctedCount = details.articleMediaCountCorrected || 0;
   
            if (correctedCount > 0) {
               if (mediaDensity >= 0.3 && mediaDensity <= 1.5) {
                  score += 1;
               } else if (mediaDensity > 1.5) {
                  score += 1.5;
               }
            }
   
            // 4) خصم على الصور غير الحرة
            if (details.nonFreeImagesCount > 0) {
               const nonFreePenalty = Math.min(details.nonFreeImagesCount * 0.3, 2);
               score -= nonFreePenalty;
            }
   
            // 5) خصم على جودة النص البديل السيئة
            if (details.badAltTextCount > 0) {
               const altTextPenalty = Math.min(details.badAltTextCount * 0.2, 2);
               score -= altTextPenalty;
            }
   
            // 6) مكافأة على الأوصاف العربية في كومنز
            const commonsLikely = details.commonsLikelyCount || 0;
            const arabicDescLikely = details.arabicDescriptionLikelyCount || 0;
   
            if (commonsLikely > 0 && arabicDescLikely >= commonsLikely / 2) {
               score += 0.5;
            }
   
            // 7) خصم إذا كانت الصور المصفاة (أعلام/أيقونات) أكثر من الصور الإعلامية
            const filteredOut = details.filteredOutImages || 0;
            if (filteredOut > informativeImages) {
               score -= 1;
            }
   
            // التأكد من بقاء النقاط في النطاق المقبول (0-10)
            return Math.max(0, Math.min(10, score));
         }
   
         /**
          * إنشاء تقرير نصي للنسخ
          */
         generateTextReport(result) {
            const lines = [
               'نتيجة تحليل جودة المقالة',
               '═══════════════════════════════',
               `المجموع: ${result.total} / 100`,
               `التقييم: ${result.level}`,
               '',
               'التفاصيل:',
               '───────────────────────────────',
               `• البنية: ${result.scores.structure} / 25 (25%)`,
               `• المصادر: ${result.scores.references} / 25 (25%)`,
               `• الصيانة: ${result.scores.maintenance} / 15 (15%)`,
               `• الروابط: ${result.scores.links} / 15 (15%)`,
               `• الوسائط: ${result.scores.media} / 10 (10%)`,
               `• اللغة والأسلوب: ${result.scores.language} / 10 (10%)`,
               '',
               'ملاحظات واقتراحات:',
               '───────────────────────────────'
            ];
   
            if (result.notes.length > 0) {
               result.notes.forEach((note, i) => {
                  lines.push(`${i + 1}. ${note}`);
               });
            } else {
               lines.push('لا توجد ملاحظات كبيرة.');
            }
   
            return lines.join('\n');
         }
   
         /**
          * تحديث الأوزان (إن لزم الأمر)
          */
         setWeights(newWeights) {
            this.weights = { ...this.weights, ...newWeights };
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.ScoringEngine = ScoringEngine;

   // ========================================
   // Module: analyzers/mediaAnalyzer.js
   // ========================================

   'use strict';
   
      class MediaAnalyzer {
         constructor() {
            this.maxScore = 10;
   
            // كلمات مفتاحية لتصفية الوسائط غير المفيدة
            this.filterKeywords = [
               'flag', 'Flag', 'علم', 'logo', 'Logo', 'رمز',
               'Icon', 'icon', 'أيقونة', 'Symbol', 'symbol'
            ];
   
            // كلمات مفتاحية للصور غير الحرة
            this.nonFreeKeywords = [
               'Fair use', 'fair use', 'Fair_use',
               'Non-free', 'non-free', 'Nonfree', 'nonfree',
               'غير حر', 'غير_حر', 'fairuse', 'Fairuse'
            ];
   
            // أنماط أسماء الملفات العربية
            this.arabicPattern = /[\u0600-\u06FF]/;
         }
   
         /**
          * تحليل الوسائط في المقالة
          * @param {UnifiedArticleModel} articleModel 
          * @returns {Object}
          */
         analyze(articleModel) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            // 1. تحليل صور صندوق المعلومات
            const infoboxImages = this._countInfoboxImages(articleModel);
            results.details.infoboxImages = infoboxImages;
   
            // 2. تحليل صور المقالة (محتوى فقط)
            const articleImages = this._countArticleImages(articleModel);
            results.details.articleImages = articleImages.count;
            results.details.decorativeImages = articleImages.decorative;
            results.details.informativeImages = articleImages.informative;
   
            // 3. كشف الوسائط المتعددة الأخرى
            const multimedia = this._detectMultimedia(articleModel);
            results.details.videos = multimedia.videos;
            results.details.audios = multimedia.audios;
   
            // 4. كشف الصور بدون نص بديل
            const imagesWithoutAlt = this._findImagesWithoutAlt(articleModel);
            results.details.imagesWithoutAlt = imagesWithoutAlt;
   
            // 5. كشف صورة البداية المفقودة
            const hasLeadImage = this._hasLeadImage(articleModel);
            results.details.hasLeadImage = hasLeadImage;
   
            // 6. تصفية الوسائط غير المفيدة (NEW)
            const filtered = this._filterNonInformationalMedia(articleModel);
            results.details.filteredOutImages = filtered.count;
            
            // 7. كشف الصور غير الحرة (NEW)
            const nonFree = this._detectNonFreeImages(articleModel);
            results.details.nonFreeImagesCount = nonFree.count;
   
            // 8. فحص البيانات الوصفية في كومنز (تقديري) (NEW)
            const commonsCheck = this._checkCommonsMetadata(articleModel);
            results.details.commonsLikelyCount = commonsCheck.commonsLikely;
            results.details.arabicDescriptionLikelyCount = commonsCheck.arabicDescriptionLikely;
   
            // 9. فحص جودة النص البديل (NEW)
            const altTextQuality = this._checkAltTextQuality(articleModel);
            results.details.badAltTextCount = altTextQuality.count;
   
            // 10. عد الوسائط المصححة (NEW)
            const correctedCount = this._countCorrectedArticleMedia(articleModel);
            results.details.articleMediaCountCorrected = correctedCount;
   
            // 11. حساب كثافة الوسائط (NEW)
            const wordCount = articleModel.fullText ? articleModel.fullText.split(/\s+/).length : 0;
            results.details.mediaDensity = wordCount > 0 
               ? ((correctedCount / wordCount) * 100).toFixed(2)
               : 0;
   
            // 12. أمثلة على المشاكل (NEW)
            results.details.examples = {
               filteredOut: filtered.examples,
               nonFreeImages: nonFree.examples,
               missingImages: commonsCheck.missingExamples,
               noArabicDescription: commonsCheck.noArabicExamples,
               badAltText: altTextQuality.examples
            };
   
            // 13. حساب النقاط
            results.score = this._calculateScore(results.details, articleModel);
   
            // 14. إنشاء الملاحظات
            results.notes = this._generateNotes(results.details, articleModel);
   
            return results;
         }
   
         /**
          * عد صور صندوق المعلومات
          * @private
          */
         _countInfoboxImages(articleModel) {
            return articleModel.$parsedContent.find(`
               .infobox img,
               .infobox figure img,
               .infobox .mw-halign-center img
            `).length;
         }
   
         /**
          * عد صور المقالة (باستثناء الصور الزخرفية)
          * @private
          */
         _countArticleImages(articleModel) {
            let informativeCount = 0;
            let decorativeCount = 0;
   
            articleModel.$articleBody.find('img').each(function() {
               const $img = $(this);
               const width = parseInt($img.attr('width')) || 0;
               const height = parseInt($img.attr('height')) || 0;
               const src = $img.attr('src') || '';
   
               // استبعاد الأيقونات والأعلام الصغيرة
               const isSmallIcon = width < 60 || height < 60;
               const isFlag = src.includes('Flag_of') || src.includes('علم_');
               const isIcon = src.includes('Icon-') || src.includes('أيقونة');
   
               if (isSmallIcon || isFlag || isIcon) {
                  decorativeCount++;
               } else {
                  informativeCount++;
               }
            });
   
            return {
               count: informativeCount + decorativeCount,
               informative: informativeCount,
               decorative: decorativeCount
            };
         }
   
         /**
          * كشف الوسائط المتعددة
          * @private
          */
         _detectMultimedia(articleModel) {
            return {
               videos: articleModel.$articleBody.find('video').length,
               audios: articleModel.$articleBody.find('audio').length
            };
         }
   
         /**
          * إيجاد الصور بدون نص بديل
          * @private
          */
         _findImagesWithoutAlt(articleModel) {
            let count = 0;
            
            articleModel.$articleBody.find('img').each(function() {
               const alt = $(this).attr('alt');
               if (!alt || alt.trim() === '') {
                  count++;
               }
            });
   
            return count;
         }
   
         /**
          * كشف وجود صورة في بداية المقالة
          * @private
          */
         _hasLeadImage(articleModel) {
            // التحقق من وجود صورة في أول 500 حرف
            const $firstParagraphs = articleModel.$parsedContent.find('p').slice(0, 3);
            const hasImageNearby = $firstParagraphs.find('img').length > 0 || 
                                  articleModel.$infobox.find('img').length > 0;
            
            return hasImageNearby;
         }
   
         /**
          * تصفية الوسائط غير المفيدة (أعلام، أيقونات، شعارات)
          * @private
          */
         _filterNonInformationalMedia(articleModel) {
            const filtered = [];
            const self = this;
   
            articleModel.$articleBody.find('img').each(function() {
               const $img = $(this);
               const src = $img.attr('src') || '';
               const alt = $img.attr('alt') || '';
               const width = parseInt($img.attr('width')) || 0;
               const filename = src.split('/').pop();
   
               // فحص الكلمات المفتاحية
               const matchesKeyword = self.filterKeywords.some(keyword => 
                  filename.includes(keyword) || alt.includes(keyword) || src.includes(keyword)
               );
   
               // فحص الحجم
               const tooSmall = width > 0 && width < 60;
   
               if (matchesKeyword || tooSmall) {
                  filtered.push({
                     filename: filename.substring(0, 50),
                     reason: matchesKeyword ? 'كلمة مفتاحية' : 'صغير جداً'
                  });
               }
            });
   
            return {
               count: filtered.length,
               examples: filtered.slice(0, 5)
            };
         }
   
         /**
          * كشف الصور غير الحرة
          * @private
          */
         _detectNonFreeImages(articleModel) {
            const nonFree = [];
            const self = this;
   
            articleModel.$articleBody.find('img').each(function() {
               const $img = $(this);
               const src = $img.attr('src') || '';
               const alt = $img.attr('alt') || '';
               const filename = src.split('/').pop();
   
               // فحص الكلمات المفتاحية للصور غير الحرة
               const isNonFree = self.nonFreeKeywords.some(keyword => 
                  filename.includes(keyword) || alt.includes(keyword) || src.includes(keyword)
               );
   
               if (isNonFree) {
                  nonFree.push(filename.substring(0, 60));
               }
            });
   
            return {
               count: nonFree.length,
               examples: nonFree.slice(0, 5)
            };
         }
   
         /**
          * فحص البيانات الوصفية في كومنز (تقديري - بدون استدعاء API)
          * @private
          */
         _checkCommonsMetadata(articleModel) {
            let commonsLikely = 0;
            let arabicDescriptionLikely = 0;
            const missingExamples = [];
            const noArabicExamples = [];
            const self = this;
   
            articleModel.$articleBody.find('img').each(function() {
               const $img = $(this);
               const src = $img.attr('src') || '';
               const alt = $img.attr('alt') || '';
               const filename = src.split('/').pop();
   
               // تقدير: إذا كان المصدر يحتوي على "commons" أو "upload.wikimedia"
               const likelyFromCommons = src.includes('commons') || 
                                        src.includes('upload.wikimedia.org') ||
                                        filename.startsWith('File:') ||
                                        /\.(jpg|png|svg|jpeg|gif)$/i.test(filename);
   
               if (likelyFromCommons) {
                  commonsLikely++;
   
                  // تقدير: إذا كان اسم الملف أو النص البديل يحتوي على عربية
                  if (self.arabicPattern.test(filename) || self.arabicPattern.test(alt)) {
                     arabicDescriptionLikely++;
                  } else {
                     noArabicExamples.push(filename.substring(0, 50));
                  }
               } else {
                  missingExamples.push(filename.substring(0, 50));
               }
            });
   
            return {
               commonsLikely: commonsLikely,
               arabicDescriptionLikely: arabicDescriptionLikely,
               missingExamples: missingExamples.slice(0, 5),
               noArabicExamples: noArabicExamples.slice(0, 5)
            };
         }
   
         /**
          * فحص جودة النص البديل
          * @private
          */
         _checkAltTextQuality(articleModel) {
            const badAlt = [];
   
            articleModel.$articleBody.find('img').each(function() {
               const $img = $(this);
               const alt = $img.attr('alt') || '';
               const src = $img.attr('src') || '';
               const filename = src.split('/').pop();
   
               // نص بديل مفقود أو قصير جداً (أقل من 5 أحرف)
               if (!alt || alt.trim().length < 5) {
                  badAlt.push({
                     filename: filename.substring(0, 40),
                     alt: alt || '(مفقود)',
                     issue: alt ? 'قصير جداً' : 'مفقود'
                  });
               }
            });
   
            return {
               count: badAlt.length,
               examples: badAlt.slice(0, 5)
            };
         }
   
         /**
          * عد الوسائط المصححة (استثناء القوالب والهوامش)
          * @private
          */
         _countCorrectedArticleMedia(articleModel) {
            let count = 0;
            const self = this;
   
            // استنساخ المحتوى وإزالة العناصر غير المرغوبة
            const $content = articleModel.$parsedContent.clone();
            
            // إزالة: صندوق المعلومات، القوالب، الهوامش، الشريط الجانبي
            $content.find('.infobox, .navbox, .sidebar, .mbox, .reflist, .references').remove();
   
            // عد الصور المتبقية
            $content.find('img').each(function() {
               const $img = $(this);
               const src = $img.attr('src') || '';
               const width = parseInt($img.attr('width')) || 0;
               const filename = src.split('/').pop();
   
               // استبعاد الأيقونات والأعلام
               const isFiltered = self.filterKeywords.some(keyword => 
                  filename.includes(keyword) || src.includes(keyword)
               );
               const tooSmall = width > 0 && width < 60;
   
               if (!isFiltered && !tooSmall) {
                  count++;
               }
            });
   
            return count;
         }
   
         /**
          * حساب النقاط
          * @private
          */
         _calculateScore(details, articleModel) {
            let score = 0;
   
            // صور المقالة (0-6)
            if (details.informativeImages >= 5) score += 6;
            else if (details.informativeImages >= 3) score += 5;
            else if (details.informativeImages >= 2) score += 4;
            else if (details.informativeImages >= 1) score += 3;
   
            // صور صندوق المعلومات (0-2)
            if (details.infoboxImages > 0) score += 2;
   
            // وسائط متعددة (0-2)
            if (details.videos > 0 || details.audios > 0) score += 2;
   
            // عقوبة للصور بدون نص بديل
            if (details.imagesWithoutAlt > 0) {
               score -= Math.min(2, details.imagesWithoutAlt * 0.5);
            }
   
            return Math.max(0, Math.min(this.maxScore, score));
         }
   
         /**
          * إنشاء الملاحظات
          * @private
          */
         _generateNotes(details, articleModel) {
            const notes = [];
   
            // لا توجد وسائط
            if (details.articleImages === 0 && details.infoboxImages === 0) {
               notes.push('المقالة لا تحتوي على أي صور. يُستحسن إضافة صور توضيحية من ويكيميديا كومنز.');
            }
   
            // صور فقط في صندوق المعلومات
            else if (details.articleImages === 0 && details.infoboxImages > 0) {
               notes.push('الصور موجودة فقط في صندوق المعلومات. يُفضل إضافة صور توضيحية في متن المقالة.');
            }
   
            // قلة الصور للمقالات الطويلة
            else if (articleModel.articleLength > 5000 && details.informativeImages < 3) {
               notes.push('المقالة طويلة لكن تحتوي على صور قليلة. يُفضل إضافة المزيد من الصور التوضيحية.');
            }
   
            // صور بدون نص بديل
            if (details.imagesWithoutAlt > 0) {
               notes.push(`${details.imagesWithoutAlt} صورة بدون نص بديل (alt text). يجب إضافة وصف لجميع الصور لتحسين إمكانية الوصول.`);
            }
   
            // نسبة الصور الزخرفية عالية
            if (details.decorativeImages > details.informativeImages && details.informativeImages > 0) {
               notes.push('عدد الصور الزخرفية (أيقونات وأعلام) أكثر من الصور التوضيحية. يُفضل التركيز على الصور المفيدة.');
            }
   
            // صور غير حرة (NEW)
            if (details.nonFreeImagesCount > 0) {
               notes.push(`تم اكتشاف ${details.nonFreeImagesCount} صورة غير حرة. يُفضل استبدالها بصور حرة من ويكيميديا كومنز.`);
            }
   
            // نص بديل سيئ (NEW)
            if (details.badAltTextCount > 0) {
               notes.push(`${details.badAltTextCount} صورة بنص بديل مفقود أو قصير جداً. يجب تحسين النصوص البديلة لإمكانية الوصول.`);
            }
   
            // صور بدون وصف عربي محتمل (NEW)
            if (details.commonsLikelyCount > 0 && details.arabicDescriptionLikelyCount < details.commonsLikelyCount / 2) {
               notes.push('معظم الصور تفتقر إلى وصف عربي. يُنصح بإضافة أوصاف عربية في ويكيميديا كومنز.');
            }
   
            // كثافة وسائط منخفضة (NEW)
            if (details.mediaDensity < 0.5 && articleModel.articleLength > 3000) {
               notes.push(`كثافة الوسائط منخفضة (${details.mediaDensity}%). يُفضل إضافة المزيد من الوسائط التوضيحية.`);
            }
   
            return notes;
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.MediaAnalyzer = MediaAnalyzer;

   // ========================================
   // Module: analyzers/referenceAnalyzer.js
   // ========================================

   'use strict';
   
      class ReferenceAnalyzer {
         constructor() {
            this.maxScore = 25;
   
            // أنواع المراجع المدعومة
            this.referenceTypePatterns = {
               book: [
                  /\{\{\s*استشهاد\s+بكتاب/gi,
                  /\{\{\s*cite\s+book/gi,
                  /ISBN[\s:-]*\d{9,13}/gi
               ],
               journal: [
                  /\{\{\s*استشهاد\s+بدورية/gi,
                  /\{\{\s*استشهاد\s+بمجلة/gi,
                  /\{\{\s*cite\s+journal/gi,
                  /DOI\s*[:=]\s*10\.\d+/gi,
                  /ISSN[\s:-]*\d{4}-?\d{3}[\dXx]/gi
               ],
               news: [
                  /\{\{\s*استشهاد\s+بخبر/gi,
                  /\{\{\s*cite\s+news/gi,
                  /bbc\.com|cnn\.com|reuters\.com|aljazeera\.|france24\.|dw\.com/gi
               ],
               web: [
                  /\{\{\s*استشهاد\s+ويب/gi,
                  /\{\{\s*cite\s+web/gi
               ],
               archive: [
                  /\{\{\s*استشهاد\s+أرشيف/gi,
                  /\{\{\s*استشهاد\s+أرشيف\s+الإنترنت/gi,
                  /archive\.org|web\.archive\.org/gi
               ],
               wikidata: [
                  /\{\{\s*استشهاد\s+بويكي\s+بيانات/gi,
                  /\{\{\s*cite\s+Q\d+/gi
               ]
            };
   
            // نطاقات اللغات
            this.languageTLDs = {
               ar: ['.sa', '.eg', '.ae', '.sy', '.jo', '.iq', '.kw', '.qa', '.bh', '.om', '.ye', '.lb', '.ps', '.ma', '.tn', '.dz', '.ly', '.sd', '.mr'],
               en: ['.uk', '.us', '.au', '.nz', '.ca', '.ie'],
               fr: ['.fr', '.be', '.ch'],
               de: ['.de', '.at'],
               es: ['.es', '.mx', '.ar', '.co', '.cl', '.pe'],
               other: []
            };
   
            // ناشرون عرب معروفون
            this.arabicPublishers = [
               'الجزيرة', 'العربية', 'bbc عربي', 'سكاي نيوز عربية',
               'الشرق الأوسط', 'الأهرام', 'اليوم السابع', 'الحياة',
               'العرب', 'الخليج', 'البيان', 'الاتحاد', 'الرياض'
            ];
   
            // ناشرون إنجليز معروفون
            this.englishPublishers = [
               'BBC', 'CNN', 'Reuters', 'Guardian', 'Telegraph',
               'Times', 'Washington Post', 'New York Times',
               'Nature', 'Science', 'Britannica'
            ];
         }
   
         /**
          * تحليل المراجع
          * @param {UnifiedArticleModel} articleModel 
          * @returns {Object}
          */
         analyze(articleModel) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            // 1. عد المراجع
            const refCounts = this._countReferences(articleModel);
            results.details.totalRefs = refCounts.total;
            results.details.namedRefs = refCounts.named;
            results.details.repeatedRefs = refCounts.repeated;
   
            // 2. كشف الروابط العارية
            const bareUrls = this._detectBareUrls(articleModel);
            results.details.bareUrls = bareUrls;
   
            // 3. تحليل جودة قوالب الاستشهاد
            const citationQuality = this._analyzeCitationTemplates(articleModel);
            results.details.incompleteCitations = citationQuality.incomplete;
            results.details.completeCitations = citationQuality.complete;
   
            // 4. استخراج سنوات النشر
            const publicationYears = this._extractPublicationYears(articleModel);
            results.details.recentYears = publicationYears.recent;
            results.details.allYears = publicationYears.all;
   
            // 5. كشف قسم المراجع
            const hasRefSection = this._hasReferencesSection(articleModel);
            results.details.hasReferencesSection = hasRefSection;
   
            // 6. تقييم موثوقية المصادر
            const reliability = this._assessSourceReliability(articleModel);
            results.details.reliableSourcesCount = reliability.count;
   
            // 7. تصنيف أنواع المراجع (جديد)
            const referenceTypes = this._classifyReferenceTypes(articleModel);
            results.details.referenceTypes = referenceTypes;
   
            // 8. كشف لغات المراجع (جديد)
            const referenceLanguages = this._detectReferenceLanguages(articleModel);
            results.details.referenceLanguages = referenceLanguages;
   
            // 9. تصنيف عدد المراجع (جديد)
            const refCountCategory = this._categorizeReferenceCount(refCounts.total);
            results.details.referenceCountCategory = refCountCategory;
   
            // 10. كشف استشهادات ويكي بيانات (جديد)
            const wikidataCitations = this._detectWikidataCitations(articleModel);
            results.details.wikidataCitationsCount = wikidataCitations;
   
            // 11. كشف المراجع الناقصة (جديد)
            const incompleteRefs = this._detectIncompleteReferences(articleModel);
            results.details.incompleteReferencesCount = incompleteRefs.count;
            results.details.incompleteReferences = incompleteRefs.examples;
   
            // 12. حساب النقاط
            results.score = this._calculateScore(results.details, articleModel);
   
            // 13. إنشاء الملاحظات
            results.notes = this._generateNotes(results.details, articleModel);
   
            return results;
         }
   
         /**
          * عد المراجع بدقة
          * @private
          */
         _countReferences(articleModel) {
            const html = articleModel.html;
   
            // عد <ref> العادية
            const refMatches = html.match(/<ref[\s>]/gi);
            const totalRefs = refMatches ? refMatches.length : 0;
   
            // عد المراجع المسماة
            const namedRefs = (html.match(/<ref\s+name\s*=\s*["'][^"']+["']/gi) || []).length;
   
            // عد المراجع المكررة
            const repeatedRefs = (html.match(/<ref\s+name\s*=\s*["'][^"']+["']\s*\/>/gi) || []).length;
   
            // عد من قائمة المراجع المرئية
            const refsList = articleModel.$referencesSection.find('li').length;
   
            return {
               total: Math.max(totalRefs, refsList),
               named: namedRefs,
               repeated: repeatedRefs
            };
         }
   
         /**
          * كشف الروابط العارية
          * @private
          */
         _detectBareUrls(articleModel) {
            let html = articleModel.html;
   
            // إزالة جميع هياكل الاستشهاد
            html = html
               .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
               .replace(/<ref[^>]*\/>/gi, '')
               .replace(/\{\{\s*[Rr]eflist[^}]*\}\}/g, '')
               .replace(/\{\{\s*[Mm]راجع[^}]*\}\}/g, '')
               .replace(/<references\s*\/?>/gi, '')
               .replace(/\{\{\s*[Cc]ite[^}]*\}\}/g, '')
               .replace(/\{\{\s*استشهاد[^}]*\}\}/g, '')
               .replace(/\{\{\s*[Ww]eb\s+citation[^}]*\}\}/g, '');
   
            // إزالة الروابط من infobox و navbox
            const $tempContent = articleModel.$parsedContent.clone();
            $tempContent.find('.infobox, .navbox, .sidebar, .metadata').remove();
            
            const cleanHtml = $tempContent.html() || '';
            const bareUrlMatches = cleanHtml.match(/https?:\/\/[^\s<\]"']+/gi);
            
            return bareUrlMatches ? bareUrlMatches.length : 0;
         }
   
         /**
          * تحليل جودة قوالب الاستشهاد
          * @private
          */
         _analyzeCitationTemplates(articleModel) {
            const html = articleModel.html;
            
            // البحث عن قوالب الاستشهاد
            const citePattern = /\{\{\s*(cite|استشهاد)\s+([^}]+)\}\}/gi;
            const citations = html.match(citePattern) || [];
   
            let complete = 0;
            let incomplete = 0;
   
            citations.forEach(cite => {
               // فحص وجود معاملات أساسية
               const hasTitle = /title\s*=|عنوان\s*=/i.test(cite);
               const hasAuthor = /author\s*=|مؤلف\s*=|last\s*=|الأخير\s*=/i.test(cite);
               const hasDate = /date\s*=|تاريخ\s*=|year\s*=|سنة\s*=/i.test(cite);
               const hasUrl = /url\s*=|مسار\s*=/i.test(cite);
   
               const essentialCount = [hasTitle, hasAuthor, hasDate].filter(Boolean).length;
               
               if (essentialCount >= 2) {
                  complete++;
               } else {
                  incomplete++;
               }
            });
   
            return { complete, incomplete };
         }
   
         /**
          * استخراج سنوات النشر (وليس الوصول/الأرشفة)
          * @private
          */
         _extractPublicationYears(articleModel) {
            const html = articleModel.html;
            const text = articleModel.fullText;
   
            // البحث عن سنوات النشر في قوالب الاستشهاد
            const pubYearPattern = /(year|سنة|date|تاريخ)\s*=\s*(\d{4})/gi;
            const matches = html.match(pubYearPattern) || [];
            
            const years = matches
               .map(match => {
                  const yearMatch = match.match(/\d{4}/);
                  return yearMatch ? parseInt(yearMatch[0]) : null;
               })
               .filter(year => year && year >= 1900 && year <= 2025);
   
            // عد السنوات الحديثة (2015-2025)
            const recentYears = years.filter(year => year >= 2015).length;
   
            return {
               all: years.length,
               recent: recentYears
            };
         }
   
         /**
          * كشف قسم المراجع
          * @private
          */
         _hasReferencesSection(articleModel) {
            return articleModel.sections.some(s => 
               /مراجع|references|مصادر|ملاحظات|الهوامش/i.test(s.line)
            );
         }
   
         /**
          * تقييم موثوقية المصادر
          * @private
          */
         _assessSourceReliability(articleModel) {
            const html = articleModel.html;
            
            // مصادر موثوقة معروفة
            const reliableDomains = [
               'britannica.com',
               'nature.com',
               'science.org',
               'nejm.org',
               'who.int',
               'archive.org',
               'jstor.org',
               'springer.com',
               'cambridge.org',
               'oxford',
               'bbc.com',
               'aljazeera.net'
            ];
   
            let reliableCount = 0;
            reliableDomains.forEach(domain => {
               const regex = new RegExp(domain.replace('.', '\\.'), 'gi');
               const matches = html.match(regex);
               if (matches) {
                  reliableCount += matches.length;
               }
            });
   
            return { count: reliableCount };
         }
   
         /**
          * حساب النقاط
          * @private
          */
         _calculateScore(details, articleModel) {
            let score = 0;
   
            // عدد المراجع (0-15)
            if (details.totalRefs === 0) {
               score += 0;
            } else if (details.totalRefs === 1) {
               score += 3;
            } else if (details.totalRefs <= 3) {
               score += 7;
            } else if (details.totalRefs <= 7) {
               score += 11;
            } else if (details.totalRefs <= 15) {
               score += 14;
            } else {
               score += 15;
            }
   
            // جودة الاستشهادات (0-4)
            const totalCitations = details.completeCitations + details.incompleteCitations;
            if (totalCitations > 0) {
               const qualityRatio = details.completeCitations / totalCitations;
               if (qualityRatio >= 0.8) score += 4;
               else if (qualityRatio >= 0.6) score += 3;
               else if (qualityRatio >= 0.4) score += 2;
               else score += 1;
            }
   
            // حداثة المصادر (0-3)
            if (details.recentYears >= 5) score += 3;
            else if (details.recentYears >= 3) score += 2;
            else if (details.recentYears >= 1) score += 1;
   
            // موثوقية المصادر (0-3)
            if (details.reliableSourcesCount >= 5) score += 3;
            else if (details.reliableSourcesCount >= 2) score += 2;
            else if (details.reliableSourcesCount >= 1) score += 1;
   
            // عقوبات
            if (details.bareUrls > 0) {
               score -= Math.min(6, details.bareUrls * 2);
            }
   
            if (!details.hasReferencesSection && details.totalRefs > 0) {
               score -= 2;
            }
   
            return Math.max(0, Math.min(this.maxScore, score));
         }
   
         /**
          * تصنيف أنواع المراجع
          * @private
          */
         _classifyReferenceTypes(articleModel) {
            const html = articleModel.html;
            const types = {
               book: 0,
               journal: 0,
               news: 0,
               web: 0,
               archive: 0,
               wikidata: 0,
               unknown: 0
            };
   
            // كشف كل نوع
            Object.keys(this.referenceTypePatterns).forEach(type => {
               this.referenceTypePatterns[type].forEach(pattern => {
                  const matches = html.match(pattern);
                  if (matches) {
                     types[type] += matches.length;
                  }
               });
            });
   
            // حساب Unknown (المراجع التي لم يتم تصنيفها)
            const refCounts = this._countReferences(articleModel);
            const classifiedTotal = Object.keys(types).reduce((sum, key) => {
               return key !== 'unknown' ? sum + types[key] : sum;
            }, 0);
            types.unknown = Math.max(0, refCounts.total - classifiedTotal);
   
            return types;
         }
   
         /**
          * كشف لغات المراجع
          * @private
          */
         _detectReferenceLanguages(articleModel) {
            const html = articleModel.html;
            const languages = {
               ar: 0,
               en: 0,
               other: 0
            };
   
            // البحث عن حقل اللغة في القوالب
            const langFieldPattern = /[|]?\s*(language|لغة)\s*=\s*([a-zA-Z\s]+)/gi;
            let match;
            while ((match = langFieldPattern.exec(html)) !== null) {
               const lang = match[2].toLowerCase().trim();
               if (/arabic|عربي|ar/.test(lang)) {
                  languages.ar++;
               } else if (/english|إنجليزي|en/.test(lang)) {
                  languages.en++;
               } else {
                  languages.other++;
               }
            }
   
            // كشف من خلال الناشر
            this.arabicPublishers.forEach(publisher => {
               const regex = new RegExp(publisher, 'gi');
               const matches = html.match(regex);
               if (matches) {
                  languages.ar += matches.length;
               }
            });
   
            this.englishPublishers.forEach(publisher => {
               const regex = new RegExp(publisher, 'gi');
               const matches = html.match(regex);
               if (matches) {
                  languages.en += matches.length;
               }
            });
   
            // كشف من خلال TLD
            const urlPattern = /https?:\/\/[^\s<\]"']+/gi;
            const urls = html.match(urlPattern) || [];
            
            urls.forEach(url => {
               let classified = false;
               
               // فحص TLD العربي
               for (const tld of this.languageTLDs.ar) {
                  if (url.includes(tld)) {
                     languages.ar++;
                     classified = true;
                     break;
                  }
               }
               
               if (!classified) {
                  // فحص TLD الإنجليزي
                  for (const tld of this.languageTLDs.en) {
                     if (url.includes(tld)) {
                        languages.en++;
                        classified = true;
                        break;
                     }
                  }
               }
               
               if (!classified) {
                  // فحص TLDs أخرى
                  for (const lang in this.languageTLDs) {
                     if (lang !== 'ar' && lang !== 'en') {
                        for (const tld of this.languageTLDs[lang]) {
                           if (url.includes(tld)) {
                              languages.other++;
                              classified = true;
                              break;
                           }
                        }
                        if (classified) break;
                     }
                  }
               }
            });
   
            return languages;
         }
   
         /**
          * تصنيف عدد المراجع
          * @private
          */
         _categorizeReferenceCount(totalRefs) {
            if (totalRefs < 10) {
               return 'under10';
            } else if (totalRefs >= 10 && totalRefs <= 20) {
               return 'between10and20';
            } else if (totalRefs > 20 && totalRefs <= 50) {
               return 'between20and50';
            } else {
               return 'above50';
            }
         }
   
         /**
          * كشف استشهادات ويكي بيانات
          * @private
          */
         _detectWikidataCitations(articleModel) {
            const html = articleModel.html;
            let count = 0;
   
            // استشهاد بويكي بيانات
            const wikidataPattern1 = /\{\{\s*استشهاد\s+بويكي\s+بيانات/gi;
            const matches1 = html.match(wikidataPattern1);
            if (matches1) count += matches1.length;
   
            // Cite Q
            const wikidataPattern2 = /\{\{\s*cite\s+Q\d+/gi;
            const matches2 = html.match(wikidataPattern2);
            if (matches2) count += matches2.length;
   
            return count;
         }
   
         /**
          * كشف المراجع الناقصة
          * @private
          */
         _detectIncompleteReferences(articleModel) {
            const html = articleModel.html;
            
            // البحث عن قوالب الاستشهاد
            const citePattern = /\{\{\s*(cite|استشهاد)\s+([^}]+)\}\}/gi;
            const citations = [];
            let match;
            
            while ((match = citePattern.exec(html)) !== null) {
               citations.push(match[0]);
            }
   
            const incompleteExamples = [];
            let incompleteCount = 0;
   
            citations.forEach(cite => {
               // فحص الحقول الأساسية
               const hasTitle = /[|]?\s*(title|عنوان)\s*=/i.test(cite);
               const hasPublisher = /[|]?\s*(publisher|ناشر|work|عمل)\s*=/i.test(cite);
               const hasDate = /[|]?\s*(date|تاريخ|year|سنة)\s*=/i.test(cite);
               const hasUrl = /[|]?\s*(url|مسار)\s*=/i.test(cite);
   
               // اعتبار المرجع ناقصاً إذا فقد 2 أو أكثر من الحقول الأساسية
               const missingFields = [];
               if (!hasTitle) missingFields.push('العنوان');
               if (!hasPublisher) missingFields.push('الناشر');
               if (!hasDate) missingFields.push('التاريخ');
               if (!hasUrl) missingFields.push('الرابط');
   
               if (missingFields.length >= 2) {
                  incompleteCount++;
                  
                  if (incompleteExamples.length < 3) {
                     // استخراج نوع الاستشهاد
                     const typeMatch = cite.match(/\{\{\s*(cite|استشهاد)\s+(\w+)/i);
                     const type = typeMatch ? typeMatch[2] : 'unknown';
                     
                     incompleteExamples.push({
                        type: type,
                        missing: missingFields,
                        snippet: cite.substring(0, 80) + '...'
                     });
                  }
               }
            });
   
            return {
               count: incompleteCount,
               examples: incompleteExamples
            };
         }
   
         /**
          * إنشاء الملاحظات
          * @private
          */
         _generateNotes(details, articleModel) {
            const notes = [];
   
            if (details.totalRefs === 0) {
               notes.push('⚠️ المقالة بدون مراجع. يجب إضافة مصادر موثوقة لدعم المحتوى.');
            } else if (details.totalRefs < 3) {
               notes.push('عدد المراجع قليل جدًا. يُفضل إضافة مزيد من المصادر الموثوقة.');
            } else if (details.totalRefs < 7) {
               notes.push('عدد المراجع مقبول، لكن يمكن تحسينه بإضافة مصادر إضافية.');
            }
   
            if (details.bareUrls > 0) {
               notes.push(`🔗 ${details.bareUrls} رابط خارجي عاري (بدون تنسيق). يُفضل تحويلها إلى استشهادات كاملة.`);
            }
   
            if (details.incompleteCitations > 0) {
               notes.push(`📋 ${details.incompleteCitations} قالب استشهاد ناقص. يُستحسن إكمال المعلومات الأساسية (عنوان، مؤلف، تاريخ).`);
            }
   
            if (!details.hasReferencesSection && details.totalRefs > 0) {
               notes.push('يُفضل إنشاء قسم مستقل للمراجع باسم "مراجع" أو "مصادر".');
            }
   
            if (details.recentYears === 0 && details.totalRefs > 0) {
               notes.push('لا توجد مصادر حديثة (2015-2025). يُفضل تحديث المصادر إن أمكن.');
            }
   
            return notes;
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.ReferenceAnalyzer = ReferenceAnalyzer;

   // ========================================
   // Module: analyzers/structureAnalyzer.js
   // ========================================

   'use strict';
   
      class StructureAnalyzer {
         constructor() {
            this.maxScore = 30;
         }
   
         /**
          * تحليل البنية
          * @param {UnifiedArticleModel} articleModel 
          * @returns {Object}
          */
         analyze(articleModel) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            // 1. تحليل المقدمة
            const intro = this._analyzeIntro(articleModel);
            results.details.intro = intro;
   
            // 2. تحليل الأقسام
            const sections = this._analyzeSections(articleModel);
            results.details.sections = sections;
   
            // 3. كشف الأقسام المفقودة
            const missingSections = this._detectMissingSections(articleModel);
            results.details.missingSections = missingSections;
   
            // 4. كشف الأقسام الفارغة
            const emptySections = this._detectEmptySections(articleModel);
            results.details.emptySections = emptySections;
   
            // 5. تقييم التوازن البنيوي
            const balance = this._assessBalance(articleModel);
            results.details.balance = balance;
   
            // 6. كشف نمط البذرة
            const isStub = this._isStubLike(articleModel);
            results.details.isStub = isStub;
   
            // 7. حساب النقاط
            results.score = this._calculateScore(results.details, articleModel);
   
            // 8. إنشاء الملاحظات
            results.notes = this._generateNotes(results.details, articleModel);
   
            return results;
         }
   
         /**
          * تحليل المقدمة
          * @private
          */
         _analyzeIntro(articleModel) {
            const introText = articleModel.cleanIntroText;
            const introLen = introText.length;
            const articleLen = articleModel.articleLength;
   
            // حساب النسبة المثالية (10-20%)
            const idealMin = articleLen * 0.10;
            const idealMax = articleLen * 0.20;
            const isOptimalLength = introLen >= idealMin && introLen <= idealMax;
   
            // تقسيم الجمل
            const sentences = introText
               .split(/[\.!\؟\?؛;]+/)
               .map(s => s.trim())
               .filter(s => s.length > 0);
   
            let maxSentenceLen = 0;
            let longSentences = 0;
   
            sentences.forEach(s => {
               if (s.length > maxSentenceLen) maxSentenceLen = s.length;
               if (s.length > 200) longSentences++;
            });
   
            return {
               length: introLen,
               sentenceCount: sentences.length,
               maxSentenceLen,
               longSentences,
               isOptimalLength,
               percentageOfArticle: ((introLen / articleLen) * 100).toFixed(1)
            };
         }
   
         /**
          * تحليل الأقسام
          * @private
          */
         _analyzeSections(articleModel) {
            const sections = articleModel.sections;
            
            const levelCounts = {
               h2: 0,
               h3: 0,
               h4: 0,
               h5: 0,
               h6: 0
            };
   
            sections.forEach(section => {
               const level = parseInt(section.level);
               if (level === 2) levelCounts.h2++;
               else if (level === 3) levelCounts.h3++;
               else if (level === 4) levelCounts.h4++;
               else if (level === 5) levelCounts.h5++;
               else if (level === 6) levelCounts.h6++;
            });
   
            const structuralDepth = 
               (levelCounts.h2 > 0 ? 1 : 0) +
               (levelCounts.h3 > 0 ? 1 : 0) +
               (levelCounts.h4 > 0 ? 1 : 0);
   
            return {
               total: sections.length,
               levelCounts,
               structuralDepth
            };
         }
   
         /**
          * كشف الأقسام المفقودة المهمة
          * @private
          */
         _detectMissingSections(articleModel) {
            const sectionNames = articleModel.sections.map(s => s.line);
            const missing = [];
   
            // فحص الأقسام حسب نوع المقالة
            const articleTypes = articleModel.detectArticleType();
   
            // مراجع
            if (!sectionNames.some(n => /مراجع|references|مصادر/i.test(n))) {
               missing.push('مراجع');
            }
   
            // روابط خارجية (للمقالات الطويلة)
            if (articleModel.articleLength > 3000) {
               if (!sectionNames.some(n => /وصلات خارجية|external links|روابط خارجية/i.test(n))) {
                  missing.push('وصلات خارجية');
               }
            }
   
            // انظر أيضاً (للمقالات المتقدمة)
            if (articleModel.articleLength > 5000) {
               if (!sectionNames.some(n => /انظر أيضا|see also/i.test(n))) {
                  missing.push('انظر أيضاً');
               }
            }
   
            // أقسام خاصة بالسير الذاتية
            if (articleTypes.includes('biography')) {
               if (!sectionNames.some(n => /حياته|نشأته|سيرته|early life|biography/i.test(n))) {
                  missing.push('قسم الحياة المبكرة');
               }
            }
   
            return missing;
         }
   
         /**
          * كشف الأقسام الفارغة
          * @private
          */
         _detectEmptySections(articleModel) {
            const emptySections = [];
            
            articleModel.$parsedContent.find('h2, h3, h4').each(function() {
               const $heading = $(this);
               const $next = $heading.nextUntil('h2, h3, h4');
               const text = $next.text().trim();
               
               if (text.length < 50) {
                  emptySections.push($heading.text().trim());
               }
            });
   
            return emptySections;
         }
   
         /**
          * تقييم التوازن البنيوي
          * @private
          */
         _assessBalance(articleModel) {
            const articleLen = articleModel.articleLength;
            const h2Count = articleModel.sections.filter(s => s.level === 2).length;
   
            let isBalanced = true;
            let issue = null;
   
            // مقالات طويلة بدون أقسام كافية
            if (articleLen > 3000 && h2Count < 2) {
               isBalanced = false;
               issue = 'مقالة طويلة بدون أقسام كافية';
            }
   
            // أقسام كثيرة لمقالة قصيرة
            if (articleLen < 2000 && h2Count > 5) {
               isBalanced = false;
               issue = 'أقسام كثيرة لمقالة قصيرة';
            }
   
            return {
               isBalanced,
               issue
            };
         }
   
         /**
          * كشف نمط البذرة
          * @private
          */
         _isStubLike(articleModel) {
            return articleModel.sections.length <= 1 && articleModel.articleLength < 1500;
         }
   
         /**
          * حساب النقاط
          * @private
          */
         _calculateScore(details, articleModel) {
            let score = 0;
            const articleLen = articleModel.articleLength;
   
            // المقدمة (0-10)
            if (details.intro.isOptimalLength) {
               score += 10;
            } else if (details.intro.length >= 400) {
               score += 8;
            } else if (details.intro.length >= 300) {
               score += 6;
            } else if (details.intro.length >= 200) {
               score += 4;
            } else if (details.intro.length >= 150) {
               score += 2;
            }
   
            // البنية (0-12)
            if (details.isStub) {
               score += 0;
            } else if (articleLen < 2500) {
               score += 6;
            } else {
               if (details.sections.levelCounts.h2 >= 4) score += 10;
               else if (details.sections.levelCounts.h2 >= 3) score += 8;
               else if (details.sections.levelCounts.h2 >= 2) score += 6;
               else if (details.sections.levelCounts.h2 === 1) score += 3;
   
               if (details.sections.structuralDepth >= 3) score += 2;
               else if (details.sections.structuralDepth === 2) score += 1;
            }
   
            // الأقسام المهمة (0-3)
            const expectedSections = ['مراجع', 'وصلات خارجية', 'انظر أيضاً'];
            const presentCount = expectedSections.filter(s => !details.missingSections.includes(s)).length;
            score += presentCount;
   
            // التوازن (0-3)
            if (details.balance.isBalanced) score += 3;
   
            // عقوبة للأقسام الفارغة
            if (details.emptySections.length > 0) {
               score -= Math.min(3, details.emptySections.length);
            }
   
            // عقوبة للجمل الطويلة
            if (details.intro.longSentences > 0 && !articleModel.detectArticleType().includes('medical')) {
               score -= Math.min(2, details.intro.longSentences);
            }
   
            return Math.max(0, Math.min(this.maxScore, score));
         }
   
         /**
          * إنشاء الملاحظات
          * @private
          */
         _generateNotes(details, articleModel) {
            const notes = [];
   
            if (details.isStub) {
               notes.push('🚧 المقالة في مرحلة البذرة. يجب توسيعها وإضافة أقسام منظمة.');
            }
   
            if (!details.intro.isOptimalLength) {
               if (details.intro.length < 150) {
                  notes.push(`📝 المقدمة قصيرة جدًا (${details.intro.length} حرفًا). يجب توسيعها لتلخص موضوع المقالة بشكل شامل.`);
               } else if (details.intro.percentageOfArticle < 10) {
                  notes.push(`المقدمة قصيرة نسبيًا (${details.intro.percentageOfArticle}% من المقالة). المثالي: 10-20%.`);
               } else if (details.intro.percentageOfArticle > 20) {
                  notes.push(`المقدمة طويلة نسبيًا (${details.intro.percentageOfArticle}% من المقالة). قد تحتاج إلى اختصار.`);
               }
            }
   
            if (!details.balance.isBalanced) {
               notes.push(`⚖️ ${details.balance.issue}. يُستحسن إعادة تنظيم البنية.`);
            }
   
            if (details.missingSections.length > 0) {
               notes.push(`📂 أقسام مفقودة مهمة: ${details.missingSections.join('، ')}`);
            }
   
            if (details.emptySections.length > 0) {
               notes.push(`⚠️ أقسام فارغة أو قصيرة جدًا: ${details.emptySections.slice(0, 3).join('، ')}`);
            }
   
            if (details.intro.longSentences > 0) {
               notes.push(`📏 ${details.intro.longSentences} جملة طويلة جدًا في المقدمة (أكثر من 200 حرف). يُفضل تقسيمها.`);
            }
   
            return notes;
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.StructureAnalyzer = StructureAnalyzer;

   // ========================================
   // Module: analyzers/linkAnalyzer.js
   // ========================================

   'use strict';
   
      class LinkAnalyzer {
         constructor() {
            this.maxScore = 15;
         }
   
         analyze(articleModel) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            const internalLinks = articleModel.getInternalLinks();
            const redLinks = articleModel.getRedLinks();
            const externalLinks = articleModel.$articleBody.find('a.external').length;
            const wordCount = articleModel.getWordCount();
            const linkDensity = wordCount > 0 ? (internalLinks.length / wordCount * 100).toFixed(2) : 0;
   
            results.details.internalLinks = internalLinks.length;
            results.details.redLinks = redLinks.length;
            results.details.externalLinks = externalLinks;
            results.details.linkDensity = parseFloat(linkDensity);
            results.details.wordCount = wordCount;
   
            // حساب النقاط
            let score = 0;
   
            if (internalLinks.length >= 30) score += 10;
            else if (internalLinks.length >= 20) score += 8;
            else if (internalLinks.length >= 10) score += 6;
            else if (internalLinks.length >= 5) score += 4;
            else if (internalLinks.length >= 2) score += 2;
   
            if (externalLinks >= 1) score += 2;
   
            if (linkDensity >= 1.5 && linkDensity <= 5) score += 3;
            else if (linkDensity >= 0.5 && linkDensity < 1.5) score += 2;
            else if (linkDensity >= 0.2) score += 1;
   
            const totalLinks = internalLinks.length + redLinks.length;
            if (totalLinks > 0) {
               const redRatio = redLinks.length / totalLinks;
               if (redRatio > 0.4) score -= 4;
               else if (redRatio > 0.2) score -= 2;
            }
   
            results.score = Math.max(0, Math.min(this.maxScore, score));
   
            // الملاحظات
            if (internalLinks.length < 5) {
               results.notes.push('🔗 عدد الروابط الداخلية قليل جدًا. يُستحسن ربط المصطلحات المهمة.');
            } else if (internalLinks.length < 10 && articleModel.articleLength >= 2000) {
               results.notes.push('عدد الروابط الداخلية أقل من المتوقع لحجم المقالة.');
            }
   
            if (totalLinks > 0 && (redLinks.length / totalLinks) > 0.3) {
               results.notes.push(`⚠️ نسبة الروابط الحمراء مرتفعة (${((redLinks.length/totalLinks)*100).toFixed(0)}%). يُفضل إنشاء هذه الصفحات أو إزالة الروابط.`);
            }
   
            if (linkDensity < 0.5) {
               results.notes.push('كثافة الروابط منخفضة. يُفضل إضافة المزيد من الروابط الداخلية.');
            } else if (linkDensity > 7) {
               results.notes.push('كثافة الروابط مرتفعة جدًا. قد يكون هناك إفراط في الربط.');
            }
   
            return results;
         }
      }
   
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.LinkAnalyzer = LinkAnalyzer;

   // ========================================
   // Module: analyzers/grammarAnalyzer.js
   // ========================================

   'use strict';
   
      class GrammarAnalyzer {
         constructor() {
            this.maxScore = 5; // جزء من نقاط البنية
         }
   
         analyze(articleModel) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            const firstParagraphs = this._getFirstParagraphs(articleModel, 3);
            const errors = this._detectErrors(firstParagraphs, articleModel.grammarRules);
   
            results.details.errorCount = errors.length;
            results.details.errors = errors.slice(0, 10); // أول 10 أخطاء
   
            const hasTranslationTemplate = articleModel.templates.some(t => 
               t.includes('ترجمة آلية') || t.includes('Translated')
            );
            results.details.hasTranslationTemplate = hasTranslationTemplate;
   
            // حساب النقاط
            let score = this.maxScore;
   
            if (errors.length === 0) {
               score = this.maxScore;
            } else if (errors.length <= 2) {
               score = 3;
            } else if (errors.length <= 5) {
               score = 2;
            } else if (errors.length <= 10) {
               score = 1;
            } else {
               score = 0;
            }
   
            if (hasTranslationTemplate) {
               score -= 2;
            }
   
            results.score = Math.max(0, Math.min(this.maxScore, score));
   
            // الملاحظات
            if (errors.length > 0) {
               results.notes.push(`📝 تم رصد ${errors.length} خطأ لغوي محتمل في بداية المقال. يُستحسن المراجعة اللغوية.`);
            }
   
            if (hasTranslationTemplate) {
               results.notes.push('⚠️ المقالة تحتوي على قالب ترجمة آلية. يجب مراجعتها وتحسين الصياغة.');
            }
   
            return results;
         }
   
         _getFirstParagraphs(articleModel, count) {
            let result = '';
            let found = 0;
   
            articleModel.$parsedContent.find('p').each(function() {
               const txt = $(this).text().trim();
               if (txt.length >= 30) {
                  result += ' ' + txt;
                  found++;
               }
               if (found >= count) {
                  return false;
               }
            });
   
            return result;
         }
   
         _detectErrors(text, rules) {
            const errors = [];
   
            rules.forEach(rule => {
               const matches = text.match(rule.pattern);
               if (matches) {
                  matches.forEach(match => {
                     errors.push({
                        match,
                        description: rule.description,
                        suggestion: rule.suggestion
                     });
                  });
               }
            });
   
            return errors;
         }
      }
   
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.GrammarAnalyzer = GrammarAnalyzer;

   // ========================================
   // Module: analyzers/maintenanceAnalyzer.js
   // ========================================

   'use strict';
   
      class MaintenanceAnalyzer {
         constructor() {
            this.maxScore = 20;
         }
   
         analyze(articleModel) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            // 1. عد قوالب الصيانة
            const maintenanceTemplates = this._countMaintenanceTemplates(articleModel);
            results.details.maintenanceTemplates = maintenanceTemplates;
   
            // 2. عد التصنيفات
            const categories = articleModel.categories.length;
            results.details.categories = categories;
   
            // 3. كشف قوالب محددة
            const specificTemplates = this._detectSpecificTemplates(articleModel);
            results.details.hasOrphanTemplate = specificTemplates.orphan;
            results.details.hasStubTemplate = specificTemplates.stub;
            results.details.hasCleanupTemplate = specificTemplates.cleanup;
   
            // 4. حساب النقاط
            results.score = this._calculateScore(results.details);
   
            // 5. الملاحظات
            results.notes = this._generateNotes(results.details);
   
            return results;
         }
   
         _countMaintenanceTemplates(articleModel) {
            return articleModel.$parsedContent.find(`
               .ambox,
               .cleanup,
               .mw-maintenance,
               .metadata
            `).length;
         }
   
         _detectSpecificTemplates(articleModel) {
            return {
               orphan: articleModel.templates.some(t => /يتيم|orphan/i.test(t)),
               stub: articleModel.templates.some(t => /بذرة|stub/i.test(t)),
               cleanup: articleModel.templates.some(t => /تنظيف|cleanup/i.test(t))
            };
         }
   
         _calculateScore(details) {
            let score = 0;
   
            // قوالب الصيانة (0-12)
            if (details.maintenanceTemplates === 0) score += 12;
            else if (details.maintenanceTemplates === 1) score += 8;
            else if (details.maintenanceTemplates === 2) score += 5;
            else if (details.maintenanceTemplates <= 4) score += 2;
   
            // التصنيفات (0-8)
            if (details.categories >= 5) score += 8;
            else if (details.categories >= 3) score += 6;
            else if (details.categories >= 1) score += 4;
   
            return Math.max(0, Math.min(this.maxScore, score));
         }
   
         _generateNotes(details) {
            const notes = [];
   
            if (details.maintenanceTemplates > 0) {
               notes.push(`🧹 المقالة تحتوي على ${details.maintenanceTemplates} قالب صيانة. يجب معالجة المشاكل المذكورة.`);
            }
   
            if (details.categories === 0) {
               notes.push('📂 المقالة غير مُصنفة. يجب إضافة تصنيفات مناسبة.');
            } else if (details.categories < 3) {
               notes.push('عدد التصنيفات قليل. يُفضل إضافة تصنيفات أكثر تحديدًا.');
            }
   
            if (details.hasOrphanTemplate) {
               notes.push('المقالة يتيمة (لا توجد مقالات تشير إليها). يجب ربطها بمقالات أخرى.');
            }
   
            if (details.hasStubTemplate) {
               notes.push('المقالة مصنفة كبذرة. يُفضل توسيعها.');
            }
   
            return notes;
         }
      }
   
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.MaintenanceAnalyzer = MaintenanceAnalyzer;

   // ========================================
   // Module: analyzers/languageAnalyzer.js
   // ========================================

   'use strict';
   
      class LanguageAnalyzer {
         constructor() {
            // أنماط الترجمة الآلية
            this.machineTranslationPatterns = [
               /\bتم\s+\w+/g,
               /\bقام\s+ب/g,
               /\bحوالي\s+\d+/g,
               /\bوفقًا\s+ل/g,
               /\bوفقاً\s+ل/g,
               /\bفي\s+سنة\s+\d+/g,
               /\bفي\s+عام\s+\d+/g,
               /\bيُذكر\s+أن/g,
               /\bيذكر\s+أن/g,
               /\bكما\s+يلي/g,
               /\bالجدير\s+بالذكر/g,
               /\bمن\s+الجدير\s+بالذكر/g,
               /\bعلى\s+سبيل\s+المثال/g,
               /\bبشكل\s+خاص/g,
               /\bبصفة\s+خاصة/g
            ];
   
            // كلمات حشو لغوي
            this.fillerPatterns = [
               /\bبشكل\s+عام/g,
               /\bبصورة\s+عامة/g,
               /\bبصفة\s+عامة/g,
               /\bمن\s+ناحية\s+أخرى/g,
               /\bمن\s+جهة\s+أخرى/g,
               /\bفي\s+الواقع/g,
               /\bفي\s+الحقيقة/g,
               /\bبطبيعة\s+الحال/g,
               /\bفي\s+نهاية\s+المطاف/g,
               /\bفي\s+نهاية\s+الأمر/g,
               /\bكما\s+هو\s+معروف/g,
               /\bكما\s+هو\s+واضح/g
            ];
   
            // تراكيب الجمل الضعيفة
            this.weakConstructionPatterns = [
               /^في\s+\w+/,      // تبدأ بـ "في"
               /^على\s+\w+/,     // تبدأ بـ "على"
               /^من\s+\w+/,      // تبدأ بـ "من"
               /^عند\s+\w+/,     // تبدأ بـ "عند"
               /^وفقًا\s+/,      // تبدأ بـ "وفقاً"
               /^وفقاً\s+/,
               /^حسب\s+/,        // تبدأ بـ "حسب"
               /^بحسب\s+/
            ];
   
            // حدود الجمل
            this.sentenceLengthLimits = {
               tooShort: 20,
               tooLong: 200,
               ideal: { min: 40, max: 120 }
            };
   
            // حدود الفقرات
            this.paragraphLimits = {
               minLength: 50,
               idealMin: 100
            };
   
            // أنماط الجمل التي تبدأ بحروف الجر
            this.prepositionStartPatterns = [
               /^في\s+/,
               /^من\s+/,
               /^على\s+/,
               /^إلى\s+/,
               /^عن\s+/,
               /^حتى\s+/,
               /^لدى\s+/,
               /^عند\s+/,
               /^نحو\s+/,
               /^حسب\s+/,
               /^بحسب\s+/,
               /^وفقًا\s+لـ/,
               /^وفقاً\s+لـ/,
               /^بناءً\s+على/,
               /^بناء\s+على/,
               /^في\s+عام\s+/,
               /^في\s+سنة\s+/
            ];
   
            // أنماط ضعف السرد
            this.narrativeWeaknessPatterns = [
               // افتتاحيات سردية مبالغ فيها
               /تدور\s+القصة\s+حول/g,
               /وتبدأ\s+الأحداث/g,
               /وتدور\s+أحداث/g,
               /كان\s+يا\s+ما\s+كان/g,
               /في\s+قديم\s+الزمان/g,
               // أسلوب مطوّل
               /من\s+الجدير\s+بالذكر/g,
               /يجدر\s+بالذكر/g,
               /كما\s+يلي/g,
               /يمكن\s+القول\s+بأن/g,
               /يُذكر\s+أن/g,
               /يذكر\s+أن/g,
               /من\s+المعروف\s+أن/g,
               /كما\s+هو\s+معروف/g,
               // تراكيب حشو
               /بشكل\s+عام/g,
               /بصورة\s+عامة/g,
               /من\s+ناحية\s+أخرى/g,
               /من\s+جهة\s+أخرى/g,
               /بالإضافة\s+إلى\s+ذلك/g,
               /بالإضافة\s+لذلك/g,
               /علاوة\s+على\s+ذلك/g,
               /فضلاً\s+عن\s+ذلك/g,
               /في\s+الواقع/g,
               /في\s+الحقيقة/g,
               /بطبيعة\s+الحال/g
            ];
   
            // حد التشابه للكشف عن التكرار
            this.redundancySimilarityThreshold = 0.85;
            this.redundancyMinLength = 30;
         }
   
         /**
          * التحليل اللغوي الرئيسي
          * @param {Object} articleData - بيانات المقالة
          * @returns {Object} نتائج التحليل اللغوي
          */
         analyze(articleModel) {
            // استخراج البيانات النصية
            const articleData = this._extractTextData(articleModel);
   
            // التحقق من صحة المدخلات
            if (!this._validateInput(articleData)) {
               return this._getEmptyResult();
            }
   
            const fullText = articleData.fullText || '';
            const introText = articleData.introText || '';
            const grammarRules = articleData.grammarRules || [];
   
            // تحليل الجمل
            const sentences = this._segmentSentences(fullText);
            const sentenceAnalysis = this._analyzeSentences(sentences);
   
            // تحليل الفقرات
            const paragraphAnalysis = this._analyzeParagraphs(fullText);
   
            // كشف أنماط الترجمة الآلية
            const mtSignals = this._detectMachineTranslation(fullText, sentences);
   
            // كشف الأسلوب الضعيف
            const styleSignals = this._detectWeakStyle(fullText, sentences);
   
            // تطبيق قواعد النحو
            const grammarViolations = this._applyGrammarRules(fullText, grammarRules);
   
            // تحليل علامات الترقيم
            const punctuationAnalysis = this._analyzePunctuation(fullText);
   
            // كشف الجمل التي تبدأ بحروف الجر
            const prepositionAnalysis = this._detectPrepositionStart(sentences);
   
            // كشف ضعف السرد
            const narrativeAnalysis = this._detectNarrativeWeakness(fullText);
   
            // كشف التكرار والتشابه
            const redundancyAnalysis = this._detectRedundancy(sentences);
   
            // جمع الأمثلة
            const examples = this._collectExamples(
               sentences,
               mtSignals.phrases,
               grammarViolations.ruleHits,
               sentenceAnalysis.longSentences,
               prepositionAnalysis.examples,
               narrativeAnalysis.examples,
               redundancyAnalysis.examples
            );
   
            // بناء النتيجة النهائية
            return {
               machineTranslationSignals: mtSignals.count,
               weakStyleSignals: styleSignals.count,
               grammarViolations: grammarViolations.count,
               longSentences: sentenceAnalysis.longCount,
               shortSentences: sentenceAnalysis.shortCount,
               avgSentenceLength: sentenceAnalysis.avgLength,
               paragraphCount: paragraphAnalysis.total,
               emptyParagraphs: paragraphAnalysis.empty,
               nonStandardParagraphs: paragraphAnalysis.nonStandard,
               punctuationScore: punctuationAnalysis.score,
               fillerWordsCount: styleSignals.fillerCount,
               sentenceCount: sentences.length,
               prepositionStartSentences: prepositionAnalysis.count,
               narrativeWeaknessSignals: narrativeAnalysis.count,
               redundantSentences: redundancyAnalysis.count,
               examples: examples
            };
         }
   
         /**
          * استخراج البيانات النصية من نموذج المقالة
          * @private
          */
         _extractTextData(articleModel) {
            if (!articleModel) {
               return {};
            }
   
            return {
               introText: articleModel.intro?.wikitext || articleModel.intro?.text || '',
               fullText: articleModel.wikitext || this._extractFullText(articleModel),
               grammarRules: articleModel.grammarRules || []
            };
         }
   
         /**
          * استخراج النص الكامل من نموذج المقالة
          * @private
          */
         _extractFullText(articleModel) {
            let fullText = '';
   
            // المقدمة
            if (articleModel.intro) {
               fullText += articleModel.intro.wikitext || articleModel.intro.text || '';
            }
   
            // الأقسام
            if (articleModel.sections && Array.isArray(articleModel.sections)) {
               articleModel.sections.forEach(section => {
                  if (section.content) {
                     fullText += '\n\n' + section.content;
                  }
               });
            }
   
            return fullText;
         }
   
         /**
          * التحقق من صحة المدخلات
          * @private
          */
         _validateInput(articleData) {
            if (!articleData || typeof articleData !== 'object') {
               return false;
            }
   
            // يجب أن يكون هناك نص كامل على الأقل
            return !!(articleData.fullText && typeof articleData.fullText === 'string' && articleData.fullText.length > 0);
         }
   
         /**
          * تقسيم النص إلى جمل
          * @private
          */
         _segmentSentences(text) {
            if (!text || typeof text !== 'string') {
               return [];
            }
   
            // تنظيف النص من Wiki markup
            let cleanText = this._cleanWikiMarkup(text);
   
            // تقسيم الجمل باستخدام علامات الترقيم
            // نستخدم regex يدعم العربية والإنجليزية
            const sentenceDelimiters = /[.!؟?]+(?:\s+|$)/g;
            
            let sentences = cleanText.split(sentenceDelimiters);
   
            // تنظيف وتصفية الجمل
            sentences = sentences
               .map(s => s.trim())
               .filter(s => s.length > 0)
               .filter(s => !this._isListItem(s))
               .filter(s => !this._isReference(s))
               .filter(s => !this._isTemplateOrTag(s));
   
            return sentences;
         }
   
         /**
          * تنظيف Wiki markup من النص
          * @private
          */
         _cleanWikiMarkup(text) {
            return text
               // إزالة القوالب
               .replace(/\{\{[^}]*\}\}/g, '')
               // إزالة الروابط الداخلية (الاحتفاظ بالنص فقط)
               .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
               // إزالة الروابط الخارجية
               .replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, '$1')
               // إزالة المراجع
               .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
               .replace(/<ref[^>]*\/>/gi, '')
               // إزالة العناوين
               .replace(/^=+.*?=+$/gm, '')
               // إزالة القوائم
               .replace(/^[*#:;]+/gm, '')
               // إزالة HTML tags
               .replace(/<[^>]+>/g, '')
               // تنظيف المسافات المتعددة
               .replace(/\s+/g, ' ')
               .trim();
         }
   
         /**
          * فحص إذا كان السطر عنصر قائمة
          * @private
          */
         _isListItem(text) {
            return /^[\*\#\:\;]/.test(text);
         }
   
         /**
          * فحص إذا كان النص مرجعاً
          * @private
          */
         _isReference(text) {
            return /<ref/i.test(text) || text.startsWith('[') && text.endsWith(']');
         }
   
         /**
          * فحص إذا كان النص قالباً أو وسماً
          * @private
          */
         _isTemplateOrTag(text) {
            return text.startsWith('{{') || text.startsWith('<') || text.startsWith('|');
         }
   
         /**
          * تحليل الجمل
          * @private
          */
         _analyzeSentences(sentences) {
            if (!sentences || sentences.length === 0) {
               return {
                  avgLength: 0,
                  longCount: 0,
                  shortCount: 0,
                  longSentences: []
               };
            }
   
            let totalLength = 0;
            let longCount = 0;
            let shortCount = 0;
            const longSentences = [];
   
            sentences.forEach(sentence => {
               const length = sentence.length;
               totalLength += length;
   
               if (length > this.sentenceLengthLimits.tooLong) {
                  longCount++;
                  longSentences.push({
                     text: sentence.substring(0, 150) + (sentence.length > 150 ? '...' : ''),
                     length: length
                  });
               } else if (length < this.sentenceLengthLimits.tooShort) {
                  shortCount++;
               }
            });
   
            return {
               avgLength: Math.round(totalLength / sentences.length),
               longCount: longCount,
               shortCount: shortCount,
               longSentences: longSentences.slice(0, 5) // أول 5 أمثلة فقط
            };
         }
   
         /**
          * تحليل الفقرات
          * @private
          */
         _analyzeParagraphs(text) {
            if (!text || typeof text !== 'string') {
               return {
                  total: 0,
                  empty: 0,
                  nonStandard: 0
               };
            }
   
            // تقسيم النص إلى فقرات
            const paragraphs = text
               .split(/\n\s*\n/)
               .map(p => p.trim())
               .filter(p => p.length > 0);
   
            let emptyCount = 0;
            let nonStandardCount = 0;
   
            paragraphs.forEach(paragraph => {
               // فقرات فارغة أو قصيرة جداً
               if (paragraph.length < this.paragraphLimits.minLength) {
                  emptyCount++;
               }
   
               // فقرات تبدأ بتركيب ضعيف
               const startsWithWeakConstruction = this.weakConstructionPatterns.some(
                  pattern => pattern.test(paragraph)
               );
   
               if (startsWithWeakConstruction) {
                  nonStandardCount++;
               }
            });
   
            return {
               total: paragraphs.length,
               empty: emptyCount,
               nonStandard: nonStandardCount
            };
         }
   
         /**
          * كشف أنماط الترجمة الآلية
          * @private
          */
         _detectMachineTranslation(text, sentences) {
            if (!text) {
               return { count: 0, phrases: [] };
            }
   
            const detectedPhrases = [];
            let totalSignals = 0;
   
            // فحص الأنماط الشائعة للترجمة الآلية
            this.machineTranslationPatterns.forEach(pattern => {
               const matches = text.match(pattern);
               if (matches) {
                  totalSignals += matches.length;
                  matches.slice(0, 3).forEach(match => {
                     if (!detectedPhrases.includes(match)) {
                        detectedPhrases.push(match);
                     }
                  });
               }
            });
   
            // فحص الجمل التي تبدأ بأنماط ضعيفة
            sentences.forEach(sentence => {
               this.weakConstructionPatterns.forEach(pattern => {
                  if (pattern.test(sentence)) {
                     totalSignals++;
                  }
               });
            });
   
            return {
               count: totalSignals,
               phrases: detectedPhrases.slice(0, 10) // أول 10 أمثلة
            };
         }
   
         /**
          * كشف الأسلوب الضعيف
          * @private
          */
         _detectWeakStyle(text, sentences) {
            if (!text) {
               return { count: 0, fillerCount: 0 };
            }
   
            let weakStyleCount = 0;
            let fillerCount = 0;
   
            // كشف كلمات الحشو
            this.fillerPatterns.forEach(pattern => {
               const matches = text.match(pattern);
               if (matches) {
                  fillerCount += matches.length;
                  weakStyleCount += matches.length;
               }
            });
   
            // كشف التكرار المفرط لكلمات معينة
            const commonWords = this._countCommonWords(text);
            const excessiveRepetition = Object.values(commonWords).filter(count => count > 15);
            weakStyleCount += excessiveRepetition.length * 2;
   
            // كشف الجمل ذات البنية الضعيفة
            sentences.forEach(sentence => {
               // جمل طويلة جداً بدون فواصل
               if (sentence.length > 250 && !sentence.includes('،') && !sentence.includes(',')) {
                  weakStyleCount++;
               }
   
               // جمل تبدأ بـ "و" بكثرة
               if (/^و\s+\w+/.test(sentence)) {
                  weakStyleCount += 0.5;
               }
            });
   
            return {
               count: Math.round(weakStyleCount),
               fillerCount: fillerCount
            };
         }
   
         /**
          * عد الكلمات الشائعة
          * @private
          */
         _countCommonWords(text) {
            const words = text
               .replace(/[^\u0600-\u06FF\s]/g, '') // الاحتفاظ بالعربية فقط
               .split(/\s+/)
               .filter(word => word.length > 3); // كلمات أطول من 3 أحرف
   
            const wordCount = {};
   
            words.forEach(word => {
               wordCount[word] = (wordCount[word] || 0) + 1;
            });
   
            return wordCount;
         }
   
         /**
          * تطبيق قواعد النحو والإملاء
          * @private
          */
         _applyGrammarRules(text, grammarRules) {
            if (!text || !grammarRules || !Array.isArray(grammarRules)) {
               return { count: 0, ruleHits: [] };
            }
   
            let violationCount = 0;
            const ruleHits = [];
   
            grammarRules.forEach(rule => {
               if (!rule || !rule.pattern) {
                  return;
               }
   
               try {
                  // إنشاء regex من النمط
                  let pattern;
                  if (rule.pattern instanceof RegExp) {
                     pattern = rule.pattern;
                  } else if (typeof rule.pattern === 'string') {
                     // تجنب الأنماط الخطيرة
                     if (this._isSafePattern(rule.pattern)) {
                        pattern = new RegExp(rule.pattern, 'gi');
                     } else {
                        return;
                     }
                  } else {
                     return;
                  }
   
                  const matches = text.match(pattern);
                  if (matches && matches.length > 0) {
                     violationCount += matches.length;
                     ruleHits.push({
                        name: rule.name || 'قاعدة مجهولة',
                        count: matches.length,
                        examples: matches.slice(0, 2)
                     });
                  }
               } catch (error) {
                  // تجاهل الأخطاء في regex
                  console.warn('[LanguageAnalyzer] Invalid grammar rule:', rule.name);
               }
            });
   
            return {
               count: violationCount,
               ruleHits: ruleHits.slice(0, 10) // أول 10 قواعد
            };
         }
   
         /**
          * فحص أمان نمط regex
          * @private
          */
         _isSafePattern(pattern) {
            // تجنب الأنماط التي قد تسبب Catastrophic Backtracking
            const dangerousPatterns = [
               /\([^)]*\)\+\+/,           // Nested quantifiers
               /\([^)]*\)\*\*/,
               /\([^)]*\)\+\*/,
               /\(.*\)\+\(/,
               /\{0,999\}/                // Excessive ranges
            ];
   
            return !dangerousPatterns.some(dangerous => dangerous.test(pattern));
         }
   
         /**
          * تحليل علامات الترقيم
          * @private
          */
         _analyzePunctuation(text) {
            if (!text) {
               return { score: 0, ratio: 0 };
            }
   
            // عد علامات الترقيم الصحيحة
            const arabicPunctuation = (text.match(/[،؛؟]/g) || []).length;
            const englishPunctuation = (text.match(/[,;?!.]/g) || []).length;
            const totalPunctuation = arabicPunctuation + englishPunctuation;
   
            // حساب نسبة علامات الترقيم العربية
            const arabicRatio = totalPunctuation > 0 
               ? (arabicPunctuation / totalPunctuation) * 100 
               : 0;
   
            // تقييم الجودة
            let score = 0;
            if (arabicRatio > 70) {
               score = 100; // ممتاز
            } else if (arabicRatio > 50) {
               score = 75;  // جيد
            } else if (arabicRatio > 30) {
               score = 50;  // مقبول
            } else {
               score = 25;  // ضعيف
            }
   
            return {
               score: score,
               ratio: Math.round(arabicRatio),
               arabicCount: arabicPunctuation,
               englishCount: englishPunctuation
            };
         }
   
         /**
          * جمع الأمثلة للعرض
          * @private
          */
         _collectExamples(sentences, mtPhrases, grammarHits, longSentences, prepExamples, narrativeExamples, redundancyExamples) {
            return {
               longSentences: longSentences.slice(0, 3),
               machineTranslationPhrases: mtPhrases.slice(0, 8),
               grammarRuleHits: grammarHits.map(hit => ({
                  name: hit.name,
                  count: hit.count,
                  examples: hit.examples
               })).slice(0, 5),
               prepositionStartSentences: (prepExamples || []).slice(0, 3),
               narrativeWeakness: (narrativeExamples || []).slice(0, 3),
               redundantSentences: (redundancyExamples || []).slice(0, 3)
            };
         }
   
         /**
          * إرجاع نتيجة فارغة
          * @private
          */
         _getEmptyResult() {
            return {
               machineTranslationSignals: 0,
               weakStyleSignals: 0,
               grammarViolations: 0,
               longSentences: 0,
               shortSentences: 0,
               avgSentenceLength: 0,
               paragraphCount: 0,
               emptyParagraphs: 0,
               nonStandardParagraphs: 0,
               punctuationScore: 0,
               fillerWordsCount: 0,
               sentenceCount: 0,
               prepositionStartSentences: 0,
               narrativeWeaknessSignals: 0,
               redundantSentences: 0,
               examples: {
                  longSentences: [],
                  machineTranslationPhrases: [],
                  grammarRuleHits: [],
                  prepositionStartSentences: [],
                  narrativeWeakness: [],
                  redundantSentences: []
               }
            };
         }
   
         /**
          * كشف الجمل التي تبدأ بحروف الجر
          * @private
          */
         _detectPrepositionStart(sentences) {
            if (!sentences || sentences.length === 0) {
               return { count: 0, examples: [] };
            }
   
            const examples = [];
            let count = 0;
   
            sentences.forEach(sentence => {
               // فحص إذا كانت الجملة تبدأ بحرف جر
               const startsWithPreposition = this.prepositionStartPatterns.some(
                  pattern => pattern.test(sentence)
               );
   
               if (startsWithPreposition) {
                  count++;
                  if (examples.length < 3) {
                     examples.push(sentence.substring(0, 80) + (sentence.length > 80 ? '...' : ''));
                  }
               }
            });
   
            return { count, examples };
         }
   
         /**
          * كشف ضعف السرد والأسلوب المطول
          * @private
          */
         _detectNarrativeWeakness(text) {
            if (!text || typeof text !== 'string') {
               return { count: 0, examples: [] };
            }
   
            const examples = [];
            let totalCount = 0;
   
            // فحص كل نمط من أنماط ضعف السرد
            this.narrativeWeaknessPatterns.forEach(pattern => {
               const matches = text.match(pattern);
               if (matches) {
                  totalCount += matches.length;
                  
                  // إضافة أمثلة
                  matches.slice(0, 3 - examples.length).forEach(match => {
                     if (examples.length < 3) {
                        // البحث عن الجملة الكاملة التي تحتوي على هذا النمط
                        const contextStart = Math.max(0, text.indexOf(match) - 20);
                        const contextEnd = Math.min(text.length, text.indexOf(match) + match.length + 60);
                        const context = text.substring(contextStart, contextEnd).trim();
                        examples.push(context + '...');
                     }
                  });
               }
            });
   
            return { count: totalCount, examples };
         }
   
         /**
          * كشف التكرار والتشابه بين الجمل
          * @private
          */
         _detectRedundancy(sentences) {
            if (!sentences || sentences.length < 2) {
               return { count: 0, examples: [] };
            }
   
            const examples = [];
            let redundantCount = 0;
   
            // تصفية الجمل القصيرة
            const validSentences = sentences.filter(s => s.length >= this.redundancyMinLength);
   
            if (validSentences.length < 2) {
               return { count: 0, examples: [] };
            }
   
            // تطبيع الجمل للمقارنة
            const normalizedSentences = validSentences.map(s => this._normalizeSentence(s));
   
            // مقارنة كل جملة مع الجمل التالية فقط (تجنب O(n²) الكامل)
            for (let i = 0; i < validSentences.length - 1 && examples.length < 3; i++) {
               for (let j = i + 1; j < validSentences.length && examples.length < 3; j++) {
                  const similarity = this._calculateSimilarity(
                     normalizedSentences[i],
                     normalizedSentences[j]
                  );
   
                  if (similarity >= this.redundancySimilarityThreshold) {
                     redundantCount++;
                     examples.push({
                        s1: validSentences[i].substring(0, 70) + (validSentences[i].length > 70 ? '...' : ''),
                        s2: validSentences[j].substring(0, 70) + (validSentences[j].length > 70 ? '...' : ''),
                        similarity: Math.round(similarity * 100)
                     });
                  }
               }
            }
   
            return { count: redundantCount, examples };
         }
   
         /**
          * تطبيع الجملة للمقارنة (إزالة التشكيل والترقيم)
          * @private
          */
         _normalizeSentence(sentence) {
            return sentence
               // إزالة التشكيل
               .replace(/[\u064B-\u065F]/g, '')
               // إزالة علامات الترقيم
               .replace(/[.,،؛:;!؟?()[\]{}«»""'']/g, ' ')
               // توحيد المسافات
               .replace(/\s+/g, ' ')
               // تحويل إلى أحرف صغيرة (للغة الإنجليزية إن وجدت)
               .toLowerCase()
               .trim();
         }
   
         /**
          * حساب نسبة التشابه بين جملتين باستخدام Levenshtein Distance
          * @private
          */
         _calculateSimilarity(str1, str2) {
            if (!str1 || !str2) return 0;
            if (str1 === str2) return 1;
   
            const len1 = str1.length;
            const len2 = str2.length;
   
            // تجنب المعالجة على جمل طويلة جداً
            if (len1 > 500 || len2 > 500) {
               return this._simpleWordOverlap(str1, str2);
            }
   
            // حساب Levenshtein distance
            const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
   
            for (let i = 0; i <= len1; i++) matrix[0][i] = i;
            for (let j = 0; j <= len2; j++) matrix[j][0] = j;
   
            for (let j = 1; j <= len2; j++) {
               for (let i = 1; i <= len1; i++) {
                  const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                  matrix[j][i] = Math.min(
                     matrix[j - 1][i] + 1,      // deletion
                     matrix[j][i - 1] + 1,      // insertion
                     matrix[j - 1][i - 1] + cost // substitution
                  );
               }
            }
   
            const distance = matrix[len2][len1];
            const maxLength = Math.max(len1, len2);
            return 1 - (distance / maxLength);
         }
   
         /**
          * حساب التشابه البسيط بناءً على تداخل الكلمات (للجمل الطويلة)
          * @private
          */
         _simpleWordOverlap(str1, str2) {
            const words1 = new Set(str1.split(/\s+/));
            const words2 = new Set(str2.split(/\s+/));
   
            let overlap = 0;
            words1.forEach(word => {
               if (words2.has(word)) overlap++;
            });
   
            const union = words1.size + words2.size - overlap;
            return union > 0 ? overlap / union : 0;
         }
      }
   
      // تصدير الوحدة
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.LanguageAnalyzer = LanguageAnalyzer;

   // ========================================
   // Module: analyzers/revisionAnalyzer.js
   // ========================================

   'use strict';
   
      class RevisionAnalyzer {
         constructor() {
            this.maxScore = 10;
   
            // قوالب الصيانة التي تدل على قلة المراجعين
            this.lowQualityTemplates = [
               'غير مراجعة',
               'يتيمة',
               'تنظيف',
               'بذرة',
               'مصدر',
               'لا مصدر',
               'مراجع',
               'توضيح'
            ];
   
            // قوالب حروب التحرير
            this.editWarTemplates = [
               'تعارض تحرير',
               'خلاف تحريري',
               'نزاع محايد'
            ];
   
            // كلمات مفتاحية للاسترجاع
            this.revertKeywords = [
               'Reverted',
               'استرجاع',
               'تراجع',
               'تراجع عن تعديل',
               'Undid',
               'Revert'
            ];
   
            // كلمات مفتاحية للحماية
            this.protectionKeywords = [
               'هذه الصفحة محمية',
               'صفحة محمية',
               'محمية كلياً',
               'محمية جزئياً',
               'padlock',
               'قفل'
            ];
         }
   
         /**
          * تحليل استقرار المقالة
          * @param {UnifiedArticleModel} articleModel 
          * @param {Object} articleData - بيانات المقالة الخام
          * @param {jQuery} $parsedArticle - المقالة المحللة
          * @returns {Object}
          */
         analyze(articleModel, articleData, $parsedArticle) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            // 1. تقدير التعديلات في آخر 90 يوم
            const estimatedEdits = this._estimateRecentEdits($parsedArticle, articleModel);
            results.details.estimatedEditsLast90Days = estimatedEdits;
   
            // 2. تقدير عدد المحررين الفريدين
            const estimatedEditors = this._estimateUniqueEditors(articleModel, $parsedArticle);
            results.details.estimatedUniqueEditors = estimatedEditors;
   
            // 3. كشف التعديلات الكبيرة غير المتوازنة
            const largeEdits = this._detectLargeEdits(articleModel);
            results.details.largeEditsCount = largeEdits.count;
   
            // 4. كشف حروب التحرير
            const editWars = this._detectEditWars($parsedArticle, articleModel);
            results.details.hasEditWars = editWars;
   
            // 5. كشف الحماية
            const protection = this._detectProtection($parsedArticle);
            results.details.hasProtection = protection;
   
            // 6. حساب عدد إشارات عدم الاستقرار
            const revisionSignals = this._countRevisionSignals(results.details);
            results.details.revisionSignalsCount = revisionSignals;
   
            // 7. الأمثلة
            results.details.examples = {
               largeEdits: largeEdits.examples,
               instabilitySignals: this._collectInstabilitySignals(results.details)
            };
   
            // 8. حساب درجة الاستقرار
            results.details.stabilityScore = this._calculateStabilityScore(results.details);
            results.score = results.details.stabilityScore;
   
            // 9. إنشاء الملاحظات
            results.notes = this._generateNotes(results.details, articleModel);
   
            return results;
         }
   
         /**
          * تقدير عدد التعديلات الأخيرة بناءً على تاريخ آخر تعديل
          * @private
          */
         _estimateRecentEdits($parsedArticle, articleModel) {
            // البحث عن تاريخ آخر تعديل في HTML
            let lastEditDate = null;
            
            // محاولة إيجاد "آخر تعديل" أو "Last edited"
            const $page = $parsedArticle || $('body');
            const pageText = $page.text();
   
            // البحث عن أنماط التاريخ
            const datePatterns = [
               /آخر تعديل.*?(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/,
               /Last edited.*?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/,
               /تم التعديل.*?(\d{4})-(\d{2})-(\d{2})/
            ];
   
            let foundDate = false;
            for (const pattern of datePatterns) {
               const match = pageText.match(pattern);
               if (match) {
                  foundDate = true;
                  // تقدير بسيط: نفترض أن التعديل الأخير كان حديثاً
                  break;
               }
            }
   
            // التقدير بناءً على طول المقالة وجودتها
            const articleLength = articleModel.articleLength || 0;
            const hasReferences = articleModel.sections && articleModel.sections.some(s => 
               s.line && (s.line.includes('مراجع') || s.line.includes('References'))
            );
   
            // إذا وجدنا تاريخاً، نفترض نشاطاً معقولاً
            if (foundDate) {
               if (articleLength > 5000 && hasReferences) {
                  return 30; // مقالة نشطة
               } else if (articleLength > 2000) {
                  return 20; // نشاط متوسط
               } else {
                  return 10; // نشاط قليل
               }
            }
   
            // إذا لم نجد تاريخاً، نفترض نشاطاً قليلاً
            return articleLength > 3000 ? 15 : 5;
         }
   
         /**
          * تقدير عدد المحررين الفريدين
          * @private
          */
         _estimateUniqueEditors(articleModel, $parsedArticle) {
            let estimatedEditors = 1;
   
            // عد قوالب الصيانة (كلما قل عددها، زاد احتمال وجود محررين أكثر)
            let maintenanceCount = 0;
            const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
            
            this.lowQualityTemplates.forEach(template => {
               if (pageHtml.includes(template)) {
                  maintenanceCount++;
               }
            });
   
            // إذا كانت قوالب الصيانة كثيرة، المقالة غير مراجعة جيداً
            if (maintenanceCount > 3) {
               estimatedEditors = 1;
            } else if (maintenanceCount > 1) {
               estimatedEditors = 2;
            } else {
               // مقالة ذات جودة أعلى = محررون أكثر
               const hasReferences = articleModel.sections && articleModel.sections.some(s => 
                  s.line && (s.line.includes('مراجع') || s.line.includes('References'))
               );
               const sectionCount = articleModel.sections ? articleModel.sections.length : 0;
   
               if (articleModel.articleLength > 5000 && hasReferences && sectionCount >= 5) {
                  estimatedEditors = 5;
               } else if (articleModel.articleLength > 3000 && sectionCount >= 3) {
                  estimatedEditors = 4;
               } else if (articleModel.articleLength > 1500) {
                  estimatedEditors = 3;
               } else {
                  estimatedEditors = 2;
               }
            }
   
            return estimatedEditors;
         }
   
         /**
          * كشف التعديلات الكبيرة غير المتوازنة
          * @private
          */
         _detectLargeEdits(articleModel) {
            const examples = [];
            let count = 0;
   
            if (!articleModel.sections || articleModel.sections.length === 0) {
               return { count: 0, examples: [] };
            }
   
            // فحص طول الأقسام
            articleModel.sections.forEach(section => {
               if (!section.line) return;
   
               // تقدير طول القسم بناءً على المحتوى
               const sectionText = section.content || '';
               const sectionLength = sectionText.length;
   
               // قسم كبير جداً (أكثر من 4000 حرف)
               if (sectionLength > 4000) {
                  count++;
                  if (examples.length < 3) {
                     examples.push({
                        section: section.line,
                        issue: 'قسم كبير جداً',
                        length: sectionLength
                     });
                  }
               }
               // قسم صغير جداً (أقل من 80 حرف) - باستثناء المقدمة والمراجع
               else if (sectionLength > 0 && sectionLength < 80 && 
                        !section.line.includes('مراجع') && 
                        !section.line.includes('References') &&
                        !section.line.includes('وصلات خارجية')) {
                  count++;
                  if (examples.length < 3) {
                     examples.push({
                        section: section.line,
                        issue: 'قسم صغير جداً',
                        length: sectionLength
                     });
                  }
               }
            });
   
            return { count, examples };
         }
   
         /**
          * كشف حروب التحرير
          * @private
          */
         _detectEditWars($parsedArticle, articleModel) {
            const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
            const pageText = $parsedArticle ? $parsedArticle.text() : '';
   
            // فحص قوالب حروب التحرير
            for (const template of this.editWarTemplates) {
               if (pageHtml.includes(template)) {
                  return true;
               }
            }
   
            // فحص كلمات الاسترجاع
            for (const keyword of this.revertKeywords) {
               if (pageText.includes(keyword)) {
                  return true;
               }
            }
   
            return false;
         }
   
         /**
          * كشف حماية الصفحة
          * @private
          */
         _detectProtection($parsedArticle) {
            const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
            const pageText = $parsedArticle ? $parsedArticle.text() : '';
   
            // فحص كلمات الحماية
            for (const keyword of this.protectionKeywords) {
               if (pageHtml.includes(keyword) || pageText.includes(keyword)) {
                  return true;
               }
            }
   
            // فحص أيقونة القفل
            if ($parsedArticle && $parsedArticle.find('.mw-indicators-protection').length > 0) {
               return true;
            }
   
            return false;
         }
   
         /**
          * حساب عدد إشارات عدم الاستقرار
          * @private
          */
         _countRevisionSignals(details) {
            let count = 0;
   
            if (details.estimatedEditsLast90Days > 40) count++;
            if (details.estimatedUniqueEditors < 2) count++;
            if (details.largeEditsCount > 3) count++;
            if (details.hasEditWars) count++;
            if (details.hasProtection) count++;
   
            return count;
         }
   
         /**
          * جمع إشارات عدم الاستقرار
          * @private
          */
         _collectInstabilitySignals(details) {
            const signals = [];
   
            if (details.estimatedEditsLast90Days > 40) {
               signals.push('عدد كبير من التعديلات الأخيرة (أكثر من 40)');
            }
   
            if (details.estimatedUniqueEditors < 2) {
               signals.push('عدد قليل من المحررين (أقل من 2)');
            }
   
            if (details.largeEditsCount > 3) {
               signals.push(`عدد كبير من الأقسام غير المتوازنة (${details.largeEditsCount})`);
            }
   
            if (details.hasEditWars) {
               signals.push('إشارات إلى حروب تحرير');
            }
   
            if (details.hasProtection) {
               signals.push('الصفحة محمية');
            }
   
            return signals;
         }
   
         /**
          * حساب درجة الاستقرار
          * @private
          */
         _calculateStabilityScore(details) {
            let score = 10; // البدء من الدرجة الكاملة
   
            // خصم بناءً على عدد التعديلات
            if (details.estimatedEditsLast90Days > 40) {
               score -= 2;
            }
   
            // خصم على قلة المحررين
            if (details.estimatedUniqueEditors < 2) {
               score -= 1;
            }
   
            // خصم على التعديلات الكبيرة غير المتوازنة
            if (details.largeEditsCount > 3) {
               score -= 2;
            }
   
            // خصم كبير على حروب التحرير
            if (details.hasEditWars) {
               score -= 3;
            }
   
            // خصم على الحماية
            if (details.hasProtection) {
               score -= 1;
            }
   
            // التأكد من بقاء النقاط في النطاق المقبول
            return Math.max(0, Math.min(this.maxScore, score));
         }
   
         /**
          * إنشاء الملاحظات
          * @private
          */
         _generateNotes(details, articleModel) {
            const notes = [];
   
            // تعديلات كثيرة
            if (details.estimatedEditsLast90Days > 40) {
               notes.push(`المقالة تشهد نشاطاً تحريرياً كثيفاً (تقدير: ${details.estimatedEditsLast90Days} تعديل في آخر 90 يوم). قد يشير هذا إلى مقالة نشطة أو غير مستقرة.`);
            } else if (details.estimatedEditsLast90Days < 10) {
               notes.push('المقالة تشهد نشاطاً تحريرياً قليلاً. قد تحتاج إلى مزيد من التطوير والتحديث.');
            }
   
            // محررون قليلون
            if (details.estimatedUniqueEditors < 2) {
               notes.push('المقالة يبدو أنها من إنشاء محرر واحد أو عدد قليل جداً من المحررين. يُفضل تعاون عدة محررين لتحسين الجودة.');
            } else if (details.estimatedUniqueEditors >= 5) {
               notes.push('المقالة تبدو أنها من تطوير عدة محررين، مما يدل على تعاون جيد ومراجعة متعددة.');
            }
   
            // أقسام غير متوازنة
            if (details.largeEditsCount > 3) {
               notes.push(`تحتوي المقالة على ${details.largeEditsCount} قسم/أقسام غير متوازنة (كبيرة جداً أو صغيرة جداً). يُنصح بمراجعة توزيع المحتوى.`);
            }
   
            // حروب تحرير
            if (details.hasEditWars) {
               notes.push('⚠️ تم اكتشاف إشارات إلى حروب تحرير أو خلافات تحريرية. قد تحتاج المقالة إلى وساطة أو مراجعة محايدة.');
            }
   
            // حماية
            if (details.hasProtection) {
               notes.push('🔒 الصفحة محمية. هذا قد يشير إلى حروب تحرير سابقة أو محتوى حساس.');
            }
   
            // استقرار جيد
            if (details.stabilityScore >= 8 && !details.hasEditWars) {
               notes.push('✅ المقالة تبدو مستقرة وذات جودة تحريرية جيدة.');
            }
   
            return notes;
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.RevisionAnalyzer = RevisionAnalyzer;

   // ========================================
   // Module: analyzers/wikidataIntegrationAnalyzer.js
   // ========================================

   'use strict';
   
      class WikidataIntegrationAnalyzer {
         constructor() {
            this.maxScore = 10;
   
            // قوالب ويكي بيانات
            this.wikidataTemplates = [
               'ويكي بيانات',
               'Wikidata',
               'استشهاد بويكي بيانات',
               'Cite Q'
            ];
   
            // قوالب الوصلات بين اللغات
            this.interwikiTemplates = [
               'وإو',
               'Interlanguage link',
               'Ill',
               'Ill-wd',
               'Interlang',
               'وصلة بين لغوية'
            ];
   
            // قوالب المشاريع الشقيقة
            this.sisterProjectTemplates = [
               'شقيقات ويكيميديا',
               'روابط شقيقة',
               'Commons',
               'Wikisource',
               'Wiktionary',
               'Wikiquote',
               'Wikibooks',
               'Wikinews',
               'Wikiversity',
               'Wikivoyage',
               'كومنز',
               'ويكي مصدر',
               'ويكاموس',
               'ويكي الاقتباس'
            ];
   
            // كلمات مفتاحية للبحث عن ويكي بيانات
            this.wikidataKeywords = [
               'wikibase',
               'wikidata.org',
               'wikidata',
               'p-wikibase-otherprojects'
            ];
         }
   
         /**
          * تحليل تكامل ويكي بيانات والمشاريع الشقيقة
          * @param {UnifiedArticleModel} articleModel 
          * @param {Object} articleData - بيانات المقالة الخام
          * @param {jQuery} $parsedArticle - المقالة المحللة
          * @returns {Object}
          */
         analyze(articleModel, articleData, $parsedArticle) {
            const results = {
               score: 0,
               details: {},
               notes: []
            };
   
            // 1. كشف الربط مع ويكي بيانات
            const wikidataBinding = this._detectWikidataBinding($parsedArticle, articleModel);
            results.details.linkedToWikidata = wikidataBinding.linked;
            results.details.wikidataItemId = wikidataBinding.itemId;
            results.details.missingWikidataLink = !wikidataBinding.linked;
   
            // 2. كشف قوالب الوصلات بين اللغات
            const interwikiLinks = this._detectInterwikiLinks($parsedArticle, articleModel);
            results.details.usesInterwikiTemplate = interwikiLinks.count > 0;
            results.details.interwikiLinksCount = interwikiLinks.count;
   
            // 3. كشف قوالب المشاريع الشقيقة
            const sisterProjects = this._detectSisterProjectBoxes($parsedArticle, articleModel);
            results.details.sisterProjectBoxesCount = sisterProjects.count;
   
            // 4. تحديد المشاريع الشقيقة المفقودة
            results.details.missingSisterLinks = interwikiLinks.count === 0 && sisterProjects.count === 0;
   
            // 5. حساب عدد إشارات التكامل عبر المشاريع
            results.details.crossProjectSignalsCount = this._countCrossProjectSignals(results.details);
   
            // 6. الأمثلة
            results.details.examples = {
               interwikiLinks: interwikiLinks.examples,
               sisterBoxes: sisterProjects.examples,
               wikidataHints: wikidataBinding.hints
            };
   
            // 7. حساب درجة التكامل عبر المشاريع
            results.details.crossProjectScore = this._calculateCrossProjectScore(results.details);
            results.score = results.details.crossProjectScore;
   
            // 8. إنشاء الملاحظات
            results.notes = this._generateNotes(results.details, articleModel);
   
            return results;
         }
   
         /**
          * كشف الربط مع ويكي بيانات
          * @private
          */
         _detectWikidataBinding($parsedArticle, articleModel) {
            const result = {
               linked: false,
               itemId: null,
               hints: []
            };
   
            const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
            const pageText = $parsedArticle ? $parsedArticle.text() : '';
   
            // البحث عن كلمات مفتاحية لويكي بيانات
            for (const keyword of this.wikidataKeywords) {
               if (pageHtml.includes(keyword) || pageText.includes(keyword)) {
                  result.linked = true;
                  break;
               }
            }
   
            // محاولة استخراج معرف ويكي بيانات
            const qidPatterns = [
               /wikidata\.org\/entity\/(Q\d+)/i,
               /wikidata\.org\/wiki\/(Q\d+)/i,
               /\bQ(\d{3,})\b/
            ];
   
            for (const pattern of qidPatterns) {
               const match = pageHtml.match(pattern);
               if (match) {
                  result.itemId = match[1].startsWith('Q') ? match[1] : 'Q' + match[1];
                  result.linked = true;
                  break;
               }
            }
   
            // البحث عن قوالب ويكي بيانات
            this.wikidataTemplates.forEach(template => {
               const templatePattern = new RegExp(`{{\\s*${template}`, 'i');
               if (pageHtml.match(templatePattern)) {
                  result.hints.push(template);
                  result.linked = true;
               }
            });
   
            // البحث عن قسم المشاريع الشقيقة في ويكيبيديا
            if ($parsedArticle && $parsedArticle.find('#p-wikibase-otherprojects').length > 0) {
               result.linked = true;
            }
   
            return result;
         }
   
         /**
          * كشف قوالب الوصلات بين اللغات
          * @private
          */
         _detectInterwikiLinks($parsedArticle, articleModel) {
            const result = {
               count: 0,
               examples: []
            };
   
            const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
   
            // البحث عن قوالب الوصلات بين اللغات
            this.interwikiTemplates.forEach(template => {
               // نمط مرن للبحث عن القوالب
               const patterns = [
                  new RegExp(`{{\\s*${template}\\s*\\|([^}]+)}}`, 'gi'),
                  new RegExp(`{{\\s*${template}\\s*}}`, 'gi')
               ];
   
               patterns.forEach(pattern => {
                  const matches = pageHtml.matchAll(pattern);
                  for (const match of matches) {
                     result.count++;
                     if (result.examples.length < 3) {
                        const templateContent = match[0].substring(0, 80);
                        result.examples.push({
                           template: template,
                           snippet: templateContent
                        });
                     }
                  }
               });
            });
   
            return result;
         }
   
         /**
          * كشف قوالب المشاريع الشقيقة
          * @private
          */
         _detectSisterProjectBoxes($parsedArticle, articleModel) {
            const result = {
               count: 0,
               examples: []
            };
   
            const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
   
            // البحث عن قوالب المشاريع الشقيقة
            this.sisterProjectTemplates.forEach(template => {
               const patterns = [
                  new RegExp(`{{\\s*${template}\\s*\\|([^}]+)}}`, 'gi'),
                  new RegExp(`{{\\s*${template}\\s*}}`, 'gi')
               ];
   
               patterns.forEach(pattern => {
                  const matches = pageHtml.matchAll(pattern);
                  for (const match of matches) {
                     result.count++;
                     if (result.examples.length < 3) {
                        result.examples.push({
                           project: template,
                           snippet: match[0].substring(0, 60)
                        });
                     }
                  }
               });
            });
   
            // البحث عن روابط مباشرة للمشاريع الشقيقة
            const sisterProjectDomains = [
               'commons.wikimedia.org',
               'wikidata.org',
               'wikisource.org',
               'wiktionary.org',
               'wikiquote.org',
               'wikibooks.org',
               'wikinews.org'
            ];
   
            sisterProjectDomains.forEach(domain => {
               if (pageHtml.includes(domain)) {
                  result.count++;
               }
            });
   
            return result;
         }
   
         /**
          * حساب عدد إشارات التكامل عبر المشاريع
          * @private
          */
         _countCrossProjectSignals(details) {
            let count = 0;
   
            if (details.linkedToWikidata) count++;
            if (details.usesInterwikiTemplate) count++;
            if (details.sisterProjectBoxesCount > 0) count++;
            if (details.wikidataItemId) count++;
            if (details.interwikiLinksCount >= 3) count++;
   
            return count;
         }
   
         /**
          * حساب درجة التكامل عبر المشاريع
          * @private
          */
         _calculateCrossProjectScore(details) {
            let score = 10; // البدء من الدرجة الكاملة
   
            // خصم على فقدان الربط مع ويكي بيانات
            if (details.missingWikidataLink) {
               score -= 4;
            }
   
            // خصم على فقدان الروابط الشقيقة
            if (details.missingSisterLinks) {
               score -= 2;
            }
   
            // خصم على عدم وجود صناديق المشاريع الشقيقة
            if (details.sisterProjectBoxesCount === 0) {
               score -= 1;
            }
   
            // مكافأة على وجود معرف ويكي بيانات
            if (details.wikidataItemId) {
               score += 1;
            }
   
            // مكافأة على وجود عدة وصلات بين لغوية
            if (details.interwikiLinksCount >= 3) {
               score += 1;
            }
   
            // مكافأة على وجود عدة صناديق للمشاريع الشقيقة
            if (details.sisterProjectBoxesCount >= 2) {
               score += 1;
            }
   
            // التأكد من بقاء النقاط في النطاق المقبول
            return Math.max(0, Math.min(this.maxScore, score));
         }
   
         /**
          * إنشاء الملاحظات
          * @private
          */
         _generateNotes(details, articleModel) {
            const notes = [];
   
            // فقدان الربط مع ويكي بيانات
            if (details.missingWikidataLink) {
               notes.push('⚠️ المقالة غير مربوطة بعنصر ويكي بيانات. يُنصح بإضافة ربط لتحسين التكامل مع المشاريع الشقيقة.');
            } else if (details.wikidataItemId) {
               notes.push(`✅ المقالة مربوطة بعنصر ويكي بيانات: ${details.wikidataItemId}`);
            }
   
            // الوصلات بين اللغات
            if (details.interwikiLinksCount === 0) {
               notes.push('المقالة لا تحتوي على وصلات بين لغوية. يُفضل إضافة قوالب مثل {{وإو}} لربط مقالات بلغات أخرى.');
            } else if (details.interwikiLinksCount >= 3) {
               notes.push(`✅ المقالة تحتوي على ${details.interwikiLinksCount} وصلة بين لغوية، مما يحسن التنقل بين اللغات.`);
            } else {
               notes.push(`المقالة تحتوي على ${details.interwikiLinksCount} وصلة بين لغوية فقط. يمكن إضافة المزيد لتحسين التكامل.`);
            }
   
            // صناديق المشاريع الشقيقة
            if (details.sisterProjectBoxesCount === 0) {
               notes.push('المقالة لا تحتوي على روابط للمشاريع الشقيقة. يُنصح بإضافة قوالب مثل {{شقيقات ويكيميديا}} للربط مع كومنز وويكي مصدر وغيرها.');
            } else if (details.sisterProjectBoxesCount >= 2) {
               notes.push(`✅ المقالة مربوطة بـ ${details.sisterProjectBoxesCount} مشروع شقيق، مما يثري المحتوى المتاح.`);
            } else {
               notes.push(`المقالة تحتوي على ربط مع ${details.sisterProjectBoxesCount} مشروع شقيق. يمكن إضافة المزيد من الروابط.`);
            }
   
            // تقييم عام
            if (details.crossProjectScore >= 8) {
               notes.push('🌟 التكامل مع ويكي بيانات والمشاريع الشقيقة ممتاز.');
            } else if (details.crossProjectScore >= 5) {
               notes.push('التكامل مع المشاريع الشقيقة جيد، لكن يمكن تحسينه.');
            } else {
               notes.push('التكامل مع المشاريع الشقيقة ضعيف. يُنصح بتحسين الربط مع ويكي بيانات والمشاريع الأخرى.');
            }
   
            return notes;
         }
      }
   
      // تصدير
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.WikidataIntegrationAnalyzer = WikidataIntegrationAnalyzer;

   // ========================================
   // Module: ui/panelRenderer.js
   // ========================================

   'use strict';
   
      class PanelRenderer {
         constructor() {
            this.panelId = 'qum-analysis-panel';
            this.overlayId = 'qum-overlay';
         }
   
         /**
          * عرض لوحة النتائج
          * @param {Object} result 
          */
         render(result) {
            this._removeExisting();
            this._injectStyles();
            
            const $overlay = this._createOverlay();
            const $panel = this._createPanel(result);
            
            $('body').append($overlay).append($panel);
            
            this._attachEvents($overlay, $panel, result);
            
            // تطبيق الوضع الداكن إن كان مفعلًا
            if (this._isDarkModeEnabled()) {
               $panel.addClass('qum-dark-mode');
            }
         }
   
         /**
          * إزالة اللوحة الموجودة
          * @private
          */
         _removeExisting() {
            $(`#${this.panelId}, #${this.overlayId}`).remove();
         }
   
         /**
          * إنشاء الطبقة الشفافة
          * @private
          */
         _createOverlay() {
            return $('<div>')
               .attr('id', this.overlayId)
               .addClass('qum-overlay');
         }
   
         /**
          * إنشاء اللوحة الرئيسية
          * @private
          */
         _createPanel(result) {
            const $panel = $('<div>')
               .attr('id', this.panelId)
               .addClass('qum-panel');
   
            // العنوان والأزرار
            const $header = this._createHeader(result);
            $panel.append($header);
   
            // النتيجة الإجمالية
            const $summary = this._createSummary(result);
            $panel.append($summary);
   
            // جدول النتائج
            const $scoresTable = this._createScoresTable(result);
            $panel.append($scoresTable);
   
            // الملاحظات
            const $notes = this._createNotes(result);
            $panel.append($notes);
   
            return $panel;
         }
   
         /**
          * إنشاء العنوان
          * @private
          */
         _createHeader(result) {
            const $header = $('<div>').addClass('qum-header');
            
            $header.append('<h2>📊 لوحة تحليل جودة المقالة</h2>');
            
            const $buttons = $('<div>').addClass('qum-buttons');
            $buttons.append('<button id="qum-dark-toggle" title="تبديل الوضع الداكن">🌓</button>');
            $buttons.append('<button id="qum-copy" title="نسخ التقرير">📋</button>');
            $buttons.append('<button id="qum-close" title="إغلاق">×</button>');
            
            $header.append($buttons);
            
            return $header;
         }
   
         /**
          * إنشاء ملخص النتيجة
          * @private
          */
         _createSummary(result) {
            const $summary = $('<div>')
               .addClass('qum-summary')
               .addClass(`qum-${result.levelClass}`);
            
            $summary.append(`<h3>${result.level} — المجموع ${result.total} / 100</h3>`);
            
            // شريط التقدم
            const $progressBar = $('<div>').addClass('qum-progress-container');
            const $progress = $('<div>')
               .addClass('qum-progress')
               .css('width', `${result.total}%`);
            $progressBar.append($progress);
            $summary.append($progressBar);
            
            return $summary;
         }
   
         /**
          * إنشاء جدول النقاط
          * @private
          */
         _createScoresTable(result) {
            const $table = $('<table>').addClass('qum-table');
            
            // العنوان
            const $thead = $('<thead>');
            $thead.append(`
               <tr>
                  <th>المحور</th>
                  <th>النقاط</th>
                  <th>التفاصيل</th>
               </tr>
            `);
            $table.append($thead);
            
            // المحتوى
            const $tbody = $('<tbody>');
            
            // البنية
            $tbody.append(this._createScoreRow(
               '🏗️ البنية',
               result.scores.structure,
               25,
               this._getStructureDetails(result.details.structure)
            ));
            
            // المراجع
            $tbody.append(this._createScoreRow(
               '📚 المصادر',
               result.scores.references,
               25,
               this._getReferencesDetails(result.details.references)
            ));
            
            // الصيانة
            $tbody.append(this._createScoreRow(
               '🧹 الصيانة',
               result.scores.maintenance,
               15,
               this._getMaintenanceDetails(result.details.maintenance)
            ));
            
            // الروابط
            $tbody.append(this._createScoreRow(
               '🔗 الروابط',
               result.scores.links,
               15,
               this._getLinksDetails(result.details.links)
            ));
            
            // الوسائط
            $tbody.append(this._createScoreRow(
               '🖼️ الوسائط',
               result.scores.media,
               10,
               this._getMediaDetails(result.details.media)
            ));
            
            // التحليل اللغوي
            if (result.details.language) {
               $tbody.append(this._createScoreRow(
                  '✍️ اللغة والأسلوب',
                  result.scores.language,
                  10,
                  this._getLanguageDetails(result.details.language)
               ));
            }
            
            // استقرار المقالة والمراجعات
            if (result.details.revision) {
               $tbody.append(this._createScoreRow(
                  '⚖️ استقرار المقالة',
                  result.details.revision.details.stabilityScore || 0,
                  10,
                  this._getRevisionDetails(result.details.revision)
               ));
            }
            
            // تكامل ويكي بيانات والمشاريع الشقيقة
            if (result.details.wikidataIntegration) {
               $tbody.append(this._createScoreRow(
                  '🌐 تكامل ويكي بيانات',
                  result.details.wikidataIntegration.details.crossProjectScore || 0,
                  10,
                  this._getWikidataIntegrationDetails(result.details.wikidataIntegration)
               ));
            }
            
            $table.append($tbody);
            
            return $table;
         }
   
         /**
          * إنشاء صف في الجدول
          * @private
          */
         _createScoreRow(title, score, maxScore, details) {
            const percentage = ((score / maxScore) * 100).toFixed(0);
            
            return $('<tr>').append([
               $('<td>').text(title),
               $('<td>').html(`<strong>${score}</strong> / ${maxScore}`),
               $('<td>').addClass('qum-details').html(details)
            ]);
         }
   
         /**
          * تفاصيل البنية
          * @private
          */
         _getStructureDetails(structure) {
            return `
               <strong>المقدمة:</strong> ${structure.intro.length} حرفًا (${structure.intro.percentageOfArticle}%)<br>
               <strong>الأقسام:</strong> H2: ${structure.sections.levelCounts.h2} | H3: ${structure.sections.levelCounts.h3}<br>
               <strong>الأقسام المفقودة:</strong> ${structure.missingSections.length > 0 ? structure.missingSections.join('، ') : 'لا يوجد'}
            `;
         }
   
         /**
          * تفاصيل المراجع
          * @private
          */
         _getReferencesDetails(refs) {
            let html = `
               <strong>المراجع:</strong> ${refs.totalRefs}<br>
               <strong>مسماة/مكررة:</strong> ${refs.namedRefs} / ${refs.repeatedRefs}<br>
               <strong>روابط عارية:</strong> ${refs.bareUrls}<br>
               <strong>سنوات حديثة:</strong> ${refs.recentYears}
            `;
   
            // تصنيف عدد المراجع
            if (refs.referenceCountCategory) {
               const categoryLabels = {
                  'under10': 'أقل من 10',
                  'between10and20': 'بين 10 و 20',
                  'between20and50': 'بين 20 و 50',
                  'above50': 'أكثر من 50'
               };
               html += `<br><strong>تصنيف عدد المراجع:</strong> ${categoryLabels[refs.referenceCountCategory] || refs.referenceCountCategory}`;
            }
   
            // أنواع المراجع
            if (refs.referenceTypes) {
               html += '<br><br><strong>أنواع المراجع:</strong><ul style="margin: 5px 0; padding-right: 20px;">';
               html += `<li>الكتب: ${refs.referenceTypes.book}</li>`;
               html += `<li>الدوريات: ${refs.referenceTypes.journal}</li>`;
               html += `<li>الأخبار: ${refs.referenceTypes.news}</li>`;
               html += `<li>الويب: ${refs.referenceTypes.web}</li>`;
               html += `<li>الأرشيف: ${refs.referenceTypes.archive}</li>`;
               html += `<li>ويكي بيانات: ${refs.referenceTypes.wikidata}</li>`;
               html += '</ul>';
            }
   
            // لغات المصادر
            if (refs.referenceLanguages) {
               html += '<br><strong>لغات المصادر:</strong><ul style="margin: 5px 0; padding-right: 20px;">';
               html += `<li>العربية: ${refs.referenceLanguages.ar}</li>`;
               html += `<li>الإنجليزية: ${refs.referenceLanguages.en}</li>`;
               html += `<li>لغات أخرى: ${refs.referenceLanguages.other}</li>`;
               html += '</ul>';
            }
   
            // استشهادات ويكي بيانات
            if (refs.wikidataCitationsCount !== undefined) {
               html += `<br><strong>استشهادات ويكي بيانات:</strong> ${refs.wikidataCitationsCount}`;
            }
   
            // المراجع الناقصة
            if (refs.incompleteReferencesCount !== undefined) {
               html += `<br><strong>مراجع ناقصة:</strong> ${refs.incompleteReferencesCount}`;
               
               if (refs.incompleteReferences && refs.incompleteReferences.length > 0) {
                  html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
                  refs.incompleteReferences.slice(0, 3).forEach(ref => {
                     html += '<li>';
                     html += `<strong>النوع:</strong> ${ref.type}<br>`;
                     html += `<strong>الحقول الناقصة:</strong> ${ref.missing.join('، ')}<br>`;
                     html += `<strong>مقتطف:</strong> ${this._escapeHtml(ref.snippet.substring(0, 80))}${ref.snippet.length > 80 ? '...' : ''}`;
                     html += '</li>';
                  });
                  html += '</ul>';
               }
            }
   
            return html;
         }
   
         /**
          * تفاصيل الصيانة
          * @private
          */
         _getMaintenanceDetails(maintenance) {
            return `
               <strong>قوالب صيانة:</strong> ${maintenance.maintenanceTemplates}<br>
               <strong>التصنيفات:</strong> ${maintenance.categories}
            `;
         }
   
         /**
          * تفاصيل الروابط
          * @private
          */
         _getLinksDetails(links) {
            return `
               <strong>روابط داخلية:</strong> ${links.internalLinks}<br>
               <strong>روابط حمراء:</strong> ${links.redLinks}<br>
               <strong>كثافة:</strong> ${links.linkDensity}%
            `;
         }
   
         /**
          * تفاصيل الوسائط
          * @private
          */
         _getMediaDetails(media) {
            let html = `
               <strong>صور المقالة:</strong> ${media.articleImages}<br>
               <strong>صور إعلامية:</strong> ${media.informativeImages}<br>
               <strong>صور زخرفية:</strong> ${media.decorativeImages}<br>
               <strong>صور صندوق المعلومات:</strong> ${media.infoboxImages}<br>
               <strong>عدد الوسائط المصحح:</strong> ${media.articleMediaCountCorrected || 0}<br>
               <strong>فيديو/صوت:</strong> ${(media.videos || 0) + (media.audios || 0)}
            `;
   
            // كثافة الوسائط
            if (media.mediaDensity !== undefined) {
               html += `<br><br><strong>كثافة الوسائط:</strong> ${media.mediaDensity}%`;
            }
   
            // جودة الوسائط
            html += '<br><br><strong>🔍 جودة الوسائط:</strong><br>';
            html += `• صور غير حرة: ${media.nonFreeImagesCount || 0}<br>`;
            html += `• صور مصفاة (أعلام/أيقونات): ${media.filteredOutImages || 0}<br>`;
            html += `• صور بنص بديل سيئ: ${media.badAltTextCount || 0}<br>`;
            html += `• صور محتملة من كومنز: ${media.commonsLikelyCount || 0}<br>`;
            html += `• صور بوصف عربي محتمل: ${media.arabicDescriptionLikelyCount || 0}`;
   
            // أمثلة على الصور المصفاة
            if (media.examples && media.examples.filteredOut && media.examples.filteredOut.length > 0) {
               html += '<br><br><strong>أمثلة على الوسائط المصفاة:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               media.examples.filteredOut.forEach(ex => {
                  html += `<li>${this._escapeHtml(ex.filename)} - ${ex.reason}</li>`;
               });
               html += '</ul>';
            }
   
            // أمثلة على الصور غير الحرة
            if (media.examples && media.examples.nonFreeImages && media.examples.nonFreeImages.length > 0) {
               html += '<br><strong>أمثلة على الصور غير الحرة:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               media.examples.nonFreeImages.forEach(ex => {
                  html += `<li>${this._escapeHtml(ex)}</li>`;
               });
               html += '</ul>';
            }
   
            // أمثلة على صور بدون وصف عربي
            if (media.examples && media.examples.noArabicDescription && media.examples.noArabicDescription.length > 0) {
               html += '<br><strong>صور بدون وصف عربي:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               media.examples.noArabicDescription.forEach(ex => {
                  html += `<li>${this._escapeHtml(ex)}</li>`;
               });
               html += '</ul>';
            }
   
            // أمثلة على النص البديل السيئ
            if (media.examples && media.examples.badAltText && media.examples.badAltText.length > 0) {
               html += '<br><strong>أمثلة على النص البديل السيئ:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               media.examples.badAltText.forEach(ex => {
                  html += '<li>';
                  html += `<strong>الملف:</strong> ${this._escapeHtml(ex.filename)}<br>`;
                  html += `<strong>النص البديل:</strong> "${this._escapeHtml(ex.alt)}"<br>`;
                  html += `<strong>المشكلة:</strong> ${ex.issue}`;
                  html += '</li>';
               });
               html += '</ul>';
            }
   
            return html;
         }
   
         /**
          * تفاصيل التحليل اللغوي
          * @private
          */
         _getLanguageDetails(language) {
            let html = `
               <strong>الجمل:</strong> ${language.sentenceCount} (متوسط: ${language.avgSentenceLength} حرف)<br>
               <strong>أنماط ترجمة آلية:</strong> ${language.machineTranslationSignals}<br>
            `;
   
            // ضعف السرد
            if (language.narrativeWeaknessSignals > 0) {
               html += `<strong>ضعف السرد:</strong> ${language.narrativeWeaknessSignals}`;
               if (language.examples && language.examples.narrativeWeakness && language.examples.narrativeWeakness.length > 0) {
                  html += '<ul style="margin:5px 0;padding-right:20px;font-size:11px;">';
                  language.examples.narrativeWeakness.slice(0, 3).forEach(ex => {
                     html += `<li>${this._escapeHtml(ex.substring(0, 60))}${ex.length > 60 ? '...' : ''}</li>`;
                  });
                  html += '</ul>';
               } else {
                  html += '<br>';
               }
            }
   
            // بدايات الجمل بحروف الجر
            if (language.prepositionStartSentences > 0) {
               html += `<strong>جمل تبدأ بحروف جر:</strong> ${language.prepositionStartSentences}`;
               if (language.examples && language.examples.prepositionStartSentences && language.examples.prepositionStartSentences.length > 0) {
                  html += '<ul style="margin:5px 0;padding-right:20px;font-size:11px;">';
                  language.examples.prepositionStartSentences.slice(0, 3).forEach(ex => {
                     html += `<li>${this._escapeHtml(ex)}</li>`;
                  });
                  html += '</ul>';
               } else {
                  html += '<br>';
               }
            }
   
            // الجمل المتكررة
            if (language.redundantSentences > 0) {
               html += `<strong>جمل متكررة/متشابهة:</strong> ${language.redundantSentences}`;
               if (language.examples && language.examples.redundantSentences && language.examples.redundantSentences.length > 0) {
                  html += '<ul style="margin:5px 0;padding-right:20px;font-size:11px;">';
                  language.examples.redundantSentences.slice(0, 3).forEach(ex => {
                     html += `<li>تشابه ${ex.similarity}%: "${this._escapeHtml(ex.s1)}" ≈ "${this._escapeHtml(ex.s2)}"</li>`;
                  });
                  html += '</ul>';
               } else {
                  html += '<br>';
               }
            }
   
            // الأخطاء النحوية
            html += `<strong>أخطاء نحوية:</strong> ${language.grammarViolations}`;
            if (language.examples && language.examples.grammarRuleHits && language.examples.grammarRuleHits.length > 0) {
               html += '<ul style="margin:5px 0;padding-right:20px;font-size:11px;">';
               language.examples.grammarRuleHits.slice(0, 3).forEach(hit => {
                  html += `<li>${this._escapeHtml(hit.name)}: ${hit.count} مرات</li>`;
               });
               html += '</ul>';
            } else {
               html += '<br>';
            }
   
            // كلمات الحشو
            html += `<strong>كلمات حشو:</strong> ${language.fillerWordsCount}<br>`;
   
            // درجة الترقيم
            html += `<strong>درجة الترقيم:</strong> ${language.punctuationScore}/100`;
   
            return html;
         }
   
         /**
          * تفاصيل استقرار المقالة والمراجعات
          * @private
          */
         _getRevisionDetails(revision) {
            // التحقق من وجود البيانات
            if (!revision || !revision.details) {
               return '<em style="color: #999;">لا تتوفر بيانات كافية عن الاستقرار</em>';
            }
   
            const details = revision.details;
            let html = '';
   
            // درجة الاستقرار
            html += `<strong>درجة الاستقرار:</strong> ${details.stabilityScore || 0} / 10<br>`;
   
            // التعديلات الأخيرة
            html += `<strong>تقدير التعديلات (آخر 90 يوم):</strong> ${details.estimatedEditsLast90Days || 0}<br>`;
   
            // عدد المحررين
            html += `<strong>تقدير عدد المحررين:</strong> ${details.estimatedUniqueEditors || 0}<br>`;
   
            // حروب التحرير
            html += `<strong>وجود حروب تحرير:</strong> ${details.hasEditWars ? '⚠️ نعم' : '✅ لا'}<br>`;
   
            // الحماية
            html += `<strong>حماية الصفحة:</strong> ${details.hasProtection ? '🔒 نعم' : 'لا'}<br>`;
   
            // إشارات عدم الاستقرار
            html += `<strong>إشارات عدم الاستقرار:</strong> ${details.revisionSignalsCount || 0}`;
   
            // الأقسام غير المتوازنة
            if (details.largeEditsCount > 0) {
               html += `<br><br><strong>أقسام غير متوازنة:</strong> ${details.largeEditsCount}`;
               if (details.examples && details.examples.largeEdits && details.examples.largeEdits.length > 0) {
                  html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
                  details.examples.largeEdits.forEach(ex => {
                     html += '<li>';
                     html += `<strong>${this._escapeHtml(ex.section)}</strong><br>`;
                     html += `المشكلة: ${ex.issue} (${ex.length} حرف)`;
                     html += '</li>';
                  });
                  html += '</ul>';
               }
            }
   
            // إشارات عدم الاستقرار التفصيلية
            if (details.examples && details.examples.instabilitySignals && details.examples.instabilitySignals.length > 0) {
               html += '<br><strong>تفاصيل إشارات عدم الاستقرار:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               details.examples.instabilitySignals.forEach(signal => {
                  html += `<li>${this._escapeHtml(signal)}</li>`;
               });
               html += '</ul>';
            }
   
            return html;
         }
   
         /**
          * تفاصيل تكامل ويكي بيانات والمشاريع الشقيقة
          * @private
          */
         _getWikidataIntegrationDetails(integration) {
            // التحقق من وجود البيانات
            if (!integration || !integration.details) {
               return '<em style="color: #999;">لا تتوفر بيانات حول تكامل ويكي بيانات والمشاريع الشقيقة.</em>';
            }
   
            const details = integration.details;
            let html = '';
   
            // درجة التكامل
            html += `<strong>درجة التكامل:</strong> ${details.crossProjectScore || 0} / 10<br>`;
   
            // ربط ويكي بيانات
            html += `<strong>ربط ويكي بيانات:</strong> `;
            if (details.linkedToWikidata) {
               html += '✅ نعم';
               if (details.wikidataItemId) {
                  html += ` (${this._escapeHtml(details.wikidataItemId)})`;
               }
            } else {
               html += '❌ لا';
            }
            html += '<br>';
   
            // استخدام قوالب الوصلات بين اللغوية
            html += `<strong>استخدام قوالب الوصلات بين اللغوية:</strong> `;
            html += details.usesInterwikiTemplate ? '✅ نعم' : '❌ لا';
            html += ` (عدد الوصلات: ${details.interwikiLinksCount || 0})<br>`;
   
            // صناديق المشاريع الشقيقة
            html += `<strong>صناديق المشاريع الشقيقة:</strong> ${details.sisterProjectBoxesCount || 0}<br>`;
   
            // إشارات التكامل
            html += `<strong>إشارات التكامل:</strong> ${details.crossProjectSignalsCount || 0}`;
   
            // أمثلة على الوصلات بين اللغوية
            if (details.examples && details.examples.interwikiLinks && details.examples.interwikiLinks.length > 0) {
               html += '<br><br><strong>أمثلة على الوصلات بين اللغوية:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               details.examples.interwikiLinks.forEach(ex => {
                  html += '<li>';
                  html += `<strong>${this._escapeHtml(ex.template)}</strong><br>`;
                  html += `<code style="font-size: 0.85em;">${this._escapeHtml(ex.snippet)}</code>`;
                  html += '</li>';
               });
               html += '</ul>';
            }
   
            // أمثلة على صناديق المشاريع الشقيقة
            if (details.examples && details.examples.sisterBoxes && details.examples.sisterBoxes.length > 0) {
               html += '<br><strong>أمثلة على صناديق المشاريع:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               details.examples.sisterBoxes.forEach(ex => {
                  html += '<li>';
                  html += `<strong>${this._escapeHtml(ex.project)}</strong><br>`;
                  html += `<code style="font-size: 0.85em;">${this._escapeHtml(ex.snippet)}</code>`;
                  html += '</li>';
               });
               html += '</ul>';
            }
   
            // إشارات ويكي بيانات
            if (details.examples && details.examples.wikidataHints && details.examples.wikidataHints.length > 0) {
               html += '<br><strong>إشارات ويكي بيانات المستخدمة:</strong>';
               html += '<ul style="margin: 5px 0; padding-right: 20px; font-size: 0.9em;">';
               details.examples.wikidataHints.forEach(hint => {
                  html += `<li>{{${this._escapeHtml(hint)}}}</li>`;
               });
               html += '</ul>';
            }
   
            return html;
         }
   
         /**
          * إنشاء قسم الملاحظات
          * @private
          */
         _createNotes(result) {
            const $notesSection = $('<div>').addClass('qum-notes-section');
            
            $notesSection.append('<h3>💡 ملاحظات واقتراحات تحسين</h3>');
            
            if (result.notes.length > 0) {
               const $list = $('<ul>').addClass('qum-notes-list');
               result.notes.forEach(note => {
                  $list.append(`<li>${this._escapeHtml(note)}</li>`);
               });
               $notesSection.append($list);
            } else {
               $notesSection.append('<p>لا توجد ملاحظات كبيرة. المقالة في حالة جيدة.</p>');
            }
            
            return $notesSection;
         }
   
         /**
          * ربط الأحداث
          * @private
          */
         _attachEvents($overlay, $panel, result) {
            // إغلاق
            $('#qum-close, #' + this.overlayId).on('click', () => {
               this._removeExisting();
            });
            
            // نسخ
            $('#qum-copy').on('click', () => {
               this._copyReport(result);
            });
            
            // الوضع الداكن
            $('#qum-dark-toggle').on('click', () => {
               this._toggleDarkMode($panel);
            });
         }
   
         /**
          * نسخ التقرير
          * @private
          */
         _copyReport(result) {
            const scoringEngine = new window.QualityUltraMax.ScoringEngine();
            const reportText = scoringEngine.generateTextReport(result);
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
               navigator.clipboard.writeText(reportText).then(() => {
                  mw.notify('تم نسخ التقرير ✓', { type: 'success' });
               }).catch(() => {
                  this._fallbackCopy(reportText);
               });
            } else {
               this._fallbackCopy(reportText);
            }
         }
   
         /**
          * نسخ احتياطي
          * @private
          */
         _fallbackCopy(text) {
            prompt('انسخ النص التالي:', text);
         }
   
         /**
          * تبديل الوضع الداكن
          * @private
          */
         _toggleDarkMode($panel) {
            $panel.toggleClass('qum-dark-mode');
            const isDark = $panel.hasClass('qum-dark-mode');
            localStorage.setItem('qum-dark-mode', isDark ? '1' : '0');
         }
   
         /**
          * فحص الوضع الداكن
          * @private
          */
         _isDarkModeEnabled() {
            return localStorage.getItem('qum-dark-mode') === '1';
         }
   
         /**
          * تحويل النص إلى HTML آمن
          * @private
          */
         _escapeHtml(str) {
            return String(str)
               .replace(/&/g, '&amp;')
               .replace(/"/g, '&quot;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
         }
   
         /**
          * حقن CSS
          * @private
          */
         _injectStyles() {
            if ($('#qum-styles').length > 0) return;
            
            const css = window.QualityUltraMax.Styles || this._getDefaultStyles();
            $('head').append(`<style id="qum-styles">${css}</style>`);
         }
   
         /**
          * الأنماط الافتراضية
          * @private
          */
         _getDefaultStyles() {
            return `
               .qum-overlay {
                  position: fixed;
                  top: 0; left: 0; right: 0; bottom: 0;
                  background: rgba(0, 0, 0, 0.5);
                  z-index: 9998;
               }
               .qum-panel {
                  position: fixed;
                  top: 5%; left: 50%;
                  transform: translateX(-50%);
                  background: #fff;
                  border-radius: 12px;
                  border: 2px solid #0969da;
                  padding: 20px;
                  width: 700px;
                  max-width: 95%;
                  max-height: 85%;
                  overflow: auto;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                  z-index: 9999;
                  direction: rtl;
                  font-family: Tahoma, Arial, sans-serif;
               }
               .qum-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 15px;
                  padding-bottom: 10px;
                  border-bottom: 2px solid #e1e4e8;
               }
               .qum-header h2 {
                  margin: 0;
                  font-size: 20px;
                  color: #24292f;
               }
               .qum-buttons button {
                  background: #f6f8fa;
                  border: 1px solid #d0d7de;
                  border-radius: 6px;
                  padding: 6px 10px;
                  margin-left: 5px;
                  cursor: pointer;
                  font-size: 16px;
               }
               .qum-buttons button:hover {
                  background: #e1e4e8;
               }
               #qum-close {
                  background: #ef4444;
                  color: #fff;
                  border-color: #dc2626;
                  font-weight: bold;
               }
               .qum-summary {
                  text-align: center;
                  padding: 15px;
                  border-radius: 8px;
                  margin-bottom: 20px;
               }
               .qum-summary h3 {
                  margin: 0 0 10px 0;
                  font-size: 18px;
               }
               .qum-featured { background: linear-gradient(135deg, #fef3c7, #fde68a); }
               .qum-good { background: linear-gradient(135deg, #d1fae5, #a7f3d0); }
               .qum-advanced { background: linear-gradient(135deg, #dbeafe, #bfdbfe); }
               .qum-start { background: linear-gradient(135deg, #fed7aa, #fdba74); }
               .qum-stub { background: linear-gradient(135deg, #fecaca, #fca5a5); }
               .qum-progress-container {
                  background: #e5e7eb;
                  height: 20px;
                  border-radius: 10px;
                  overflow: hidden;
               }
               .qum-progress {
                  background: linear-gradient(90deg, #3b82f6, #2563eb);
                  height: 100%;
                  transition: width 0.5s ease;
               }
               .qum-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
                  font-size: 14px;
               }
               .qum-table th, .qum-table td {
                  border: 1px solid #d0d7de;
                  padding: 10px;
                  text-align: right;
               }
               .qum-table th {
                  background: #f6f8fa;
                  font-weight: bold;
               }
               .qum-table .qum-details {
                  font-size: 13px;
                  line-height: 1.6;
               }
               .qum-notes-section h3 {
                  margin: 10px 0;
                  font-size: 16px;
               }
               .qum-notes-list {
                  font-size: 14px;
                  line-height: 1.8;
                  padding-right: 20px;
               }
               .qum-dark-mode {
                  background: #1c1c1c;
                  color: #e1e4e8;
                  border-color: #30363d;
               }
               .qum-dark-mode .qum-header {
                  border-bottom-color: #30363d;
               }
               .qum-dark-mode .qum-header h2 {
                  color: #e1e4e8;
               }
               .qum-dark-mode .qum-buttons button {
                  background: #21262d;
                  border-color: #30363d;
                  color: #e1e4e8;
               }
               .qum-dark-mode .qum-table th, .qum-dark-mode .qum-table td {
                  border-color: #30363d;
               }
               .qum-dark-mode .qum-table th {
                  background: #161b22;
               }
            `;
         }
      }
   
      window.QualityUltraMax = window.QualityUltraMax || {};
      window.QualityUltraMax.PanelRenderer = PanelRenderer;

   // ========================================
   // Module: main.js
   // ========================================

   'use strict';
   
      // التأكد من وجود namespace
      window.QualityUltraMax = window.QualityUltraMax || {};
   
      /**
       * المنسق الرئيسي لـ Quality Ultra-Max
       */
      class QualityUltraMaxOrchestrator {
         constructor() {
            this.modules = {
               dataFetcher: null,
               scoringEngine: null,
               analyzers: {},
               panelRenderer: null
            };
            
            this.isInitialized = false;
            this.isAnalyzing = false;
         }
   
         /**
          * تهيئة النظام
          */
         init() {
            if (this.isInitialized) {
               console.warn('[QUM] Already initialized');
               return;
            }
   
            // التحقق من المتطلبات
            if (!this._checkRequirements()) {
               console.error('[QUM] Requirements not met');
               return;
            }
   
            // تحميل الوحدات
            this._loadModules();
   
            // إضافة زر التشغيل
            this._injectButton();
   
            this.isInitialized = true;
            console.log('[QUM] Quality Ultra-Max v3 initialized ✓');
         }
   
         /**
          * التحقق من المتطلبات
          * @private
          */
         _checkRequirements() {
            // فقط في النطاق الرئيسي
            if (mw.config.get('wgNamespaceNumber') !== 0) {
               return false;
            }
   
            // التحقق من jQuery
            if (!$ || !$.fn) {
               console.error('[QUM] jQuery not available');
               return false;
            }
   
            // التحقق من mw.Api
            if (!mw || !mw.Api) {
               console.error('[QUM] MediaWiki API not available');
               return false;
            }
   
            return true;
         }
   
         /**
          * تحميل الوحدات
          * @private
          */
         _loadModules() {
            const QUM = window.QualityUltraMax;
   
            // Core modules
            this.modules.dataFetcher = new QUM.DataFetcher();
            this.modules.scoringEngine = new QUM.ScoringEngine();
   
            // Analyzers
            this.modules.analyzers = {
               media: new QUM.MediaAnalyzer(),
               reference: new QUM.ReferenceAnalyzer(),
               structure: new QUM.StructureAnalyzer(),
               link: new QUM.LinkAnalyzer(),
               grammar: new QUM.GrammarAnalyzer(),
               maintenance: new QUM.MaintenanceAnalyzer(),
               language: new QUM.LanguageAnalyzer(),
               revision: new QUM.RevisionAnalyzer(),
               wikidataIntegration: new QUM.WikidataIntegrationAnalyzer()
            };
   
            // UI
            this.modules.panelRenderer = new QUM.PanelRenderer();
   
            console.log('[QUM] All modules loaded ✓');
         }
   
         /**
          * إضافة زر التشغيل
          * @private
          */
         _injectButton() {
            const buttonHtml = `
               <li id="qum-button-container" class="mw-list-item">
                  <a href="#" id="qum-analyze-btn" title="تحليل جودة المقالة">
                     <span>📊 تحليل الجودة</span>
                  </a>
               </li>
            `;
   
            // Vector 2022
            if ($('#p-views ul').length) {
               $('#p-views ul').append(buttonHtml);
            }
            // Vector 2010 / Legacy
            else if ($('#p-cactions ul').length) {
               $('#p-cactions ul').append(buttonHtml);
            }
            // Fallback
            else if ($('.vector-menu-content-list').first().length) {
               $('.vector-menu-content-list').first().append(buttonHtml);
            }
   
            // ربط الحدث
            $('#qum-analyze-btn').on('click', (e) => {
               e.preventDefault();
               this.analyze();
            });
   
            console.log('[QUM] Button injected ✓');
         }
   
         /**
          * بدء التحليل
          */
         async analyze() {
            if (this.isAnalyzing) {
               mw.notify('التحليل قيد التنفيذ...', { type: 'warn' });
               return;
            }
   
            this.isAnalyzing = true;
            const $button = $('#qum-analyze-btn span');
            const originalText = $button.text();
   
            try {
               // تحديث النص
               $button.text('⏳ جارٍ التحليل...');
   
               // إظهار إشعار
               const notif = mw.notify('جارٍ جمع بيانات المقالة...', {
                  type: 'info',
                  tag: 'qum-progress'
               });
   
               // الخطوة 1: جمع البيانات
               const pageTitle = mw.config.get('wgPageName');
               const data = await this.modules.dataFetcher.fetchAll(pageTitle);
   
               // الخطوة 2: بناء نموذج المقالة
               notif.close();
               mw.notify('جارٍ تحليل محتوى المقالة...', {
                  type: 'info',
                  tag: 'qum-progress'
               });
   
               const articleModel = new window.QualityUltraMax.ArticleModel(data, pageTitle);
   
               // الخطوة 3: تشغيل المحللات
               const analysisResults = await this._runAnalyzers(articleModel);
   
               // الخطوة 4: حساب النتيجة النهائية
               const finalResult = this.modules.scoringEngine.calculateFinalScore(analysisResults);
   
               // الخطوة 5: عرض النتائج
               this.modules.panelRenderer.render(finalResult);
   
               // إغلاق الإشعار
               mw.notify.close('qum-progress');
               mw.notify('تم التحليل بنجاح ✓', { type: 'success' });
   
               console.log('[QUM] Analysis complete:', finalResult);
   
            } catch (error) {
               console.error('[QUM] Analysis error:', error);
               mw.notify('حدث خطأ أثناء التحليل: ' + error.message, { type: 'error' });
            } finally {
               this.isAnalyzing = false;
               $button.text(originalText);
            }
         }
   
         /**
          * تشغيل جميع المحللات
          * @private
          */
         async _runAnalyzers(articleModel) {
            const results = {};
   
            // تشغيل المحللات
            try {
               const mediaResult = this.modules.analyzers.media.analyze(articleModel);
               const referenceResult = this.modules.analyzers.reference.analyze(articleModel);
               const structureResult = this.modules.analyzers.structure.analyze(articleModel);
               const linkResult = this.modules.analyzers.link.analyze(articleModel);
               const grammarResult = this.modules.analyzers.grammar.analyze(articleModel);
               const maintenanceResult = this.modules.analyzers.maintenance.analyze(articleModel);
               const languageResult = this.modules.analyzers.language.analyze(articleModel);
               
               // تحليل استقرار المقالة والمراجعات
               const revisionResult = this.modules.analyzers.revision.analyze(
                  articleModel,
                  articleModel.rawData,
                  articleModel.$parsedContent
               );
               
               // تحليل تكامل ويكي بيانات والمشاريع الشقيقة
               const wikidataIntegrationResult = this.modules.analyzers.wikidataIntegration.analyze(
                  articleModel,
                  articleModel.rawData,
                  articleModel.$parsedContent
               );
   
               // تنظيم النتائج بالصيغة المتوقعة
               results.mediaAnalysis = mediaResult;
               results.referenceAnalysis = referenceResult;
               results.structureAnalysis = structureResult;
               results.linkAnalysis = linkResult;
               results.grammarAnalysis = grammarResult;
               results.maintenanceAnalysis = maintenanceResult;
               results.languageAnalysis = languageResult;
               results.revisionAnalysis = revisionResult;
               results.wikidataIntegrationAnalysis = wikidataIntegrationResult;
   
            } catch (error) {
               console.error('[QUM] Analyzer error:', error);
               throw new Error('فشل تشغيل المحللات');
            }
   
            return results;
         }
   
         /**
          * إعادة تهيئة
          */
         reset() {
            this.isInitialized = false;
            this.isAnalyzing = false;
            $('#qum-button-container').remove();
            $('#qum-styles').remove();
            console.log('[QUM] Reset complete');
         }
      }
   
      /**
       * تشغيل تلقائي عند تحميل الصفحة
       */
      $(document).ready(function() {
         // التأكد من أن جميع الوحدات محملة
         if (
            window.QualityUltraMax.DataFetcher &&
            window.QualityUltraMax.ArticleModel &&
            window.QualityUltraMax.ScoringEngine &&
            window.QualityUltraMax.MediaAnalyzer &&
            window.QualityUltraMax.ReferenceAnalyzer &&
            window.QualityUltraMax.StructureAnalyzer &&
            window.QualityUltraMax.LinkAnalyzer &&
            window.QualityUltraMax.GrammarAnalyzer &&
            window.QualityUltraMax.MaintenanceAnalyzer &&
            window.QualityUltraMax.LanguageAnalyzer &&
            window.QualityUltraMax.PanelRenderer
         ) {
            const orchestrator = new QualityUltraMaxOrchestrator();
            orchestrator.init();
   
            // تصدير للوصول الخارجي
            window.QualityUltraMax.Orchestrator = orchestrator;
         } else {
            console.error('[QUM] Not all modules loaded. Cannot initialize.');
         }
      });

   console.log('[QUM] All modules loaded successfully ✓');

})(window, jQuery, mediaWiki);
