/**
 * Lumina Studio — Interactive Application Controller (Alpine.js + Vanilla ES2024)
 * Zero React/TS noodle soup. Clean reactive state for:
 * 1. Universal Material Ingestion (Files, ZIPs, YouTube, Google Drive, Web links, Notes)
 * 2. Breakdown Explainer Video Player (Synced Gemini 3.8 TTS + Web Speech fallback + Mermaid + KaTeX + Gemini Omni 1.1 Flash Video)
 * 3. Modular Lesson Plans & Guided Interactive Tutorials
 * 4. Exam & Practice Simulator with Step-by-Step AI Grading
 * 5. Spaced Repetition 3D Flashcards (SM-2)
 * 6. Interactive Force-Directed Knowledge Graph Canvas
 * 7. Multi-Turn Socratic AI Tutor + Gemini 3.8 Live Voice & Vision WebSocket
 */

document.addEventListener('alpine:init', () => {
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    });
  }

  Alpine.data('luminaStudio', () => ({
    // Navigation & Global State
    activeTab: 'ingest', // 'ingest' | 'flashcards' | 'lessons' | 'practice' | 'explainer' | 'tutor' | 'workbench'
    theme: localStorage.getItem('modernality_qz_theme') || 'light',
    searchQuery: '',
    apiKeyConfigured: false,
    elevenlabsConfigured: false,
    showApiKeyModal: false,
    apiKeyInput: '',
    elevenlabsKeyInput: '',
    elevenlabsVoice: 'Rachel',
    wbDemoAudioEl: null,
    statusMessage: '',
    errorBanner: '',

    // Google Cloud Backend & Deployment State
    gcpStatus: {
      project_id: 'personal-portfolio-470022',
      region: 'us-east4',
      gcs_bucket_name: 'personal-portfolio-470022-lumina-media',
      firestore_database: '(default)',
      firestore_active: false,
      gcs_active: false,
      storage_mode: 'Hybrid Local Disk',
      last_cloud_error: null,
    },
    gcpProjectInput: 'personal-portfolio-470022',
    gcpBucketInput: 'personal-portfolio-470022-lumina-media',
    gcpFirestoreDbInput: '(default)',
    gcpRegionInput: 'us-east4',
    isConnectingGcp: false,
    isSyncingCloud: false,
    cloudSyncMessage: '',

    // Study Kits Registry & Active Kit
    kitsList: [],
    currentKitId: '',
    currentKitRecord: null,
    customSubjects: JSON.parse(localStorage.getItem('modernality_subjects') || '[]'),
    selectedSubjectFilter: 'ALL',
    newSubjectDraft: '',
    showNewSubjectInput: false,

    // Ingestion State
    selectedFiles: [],
    urlInput: '',
    addedUrls: [],
    rawNotes: '',
    customFocus: '',
    ingestSubjectName: '',
    ingestMode: 'new_kit', // 'new_kit' | 'append_kit'
    useDeepModel: false,
    isSynthesizing: false,
    synthesisStepText: '',

    // Breakdown Explainer Player State
    currentSlideIndex: 0,
    isPlayingSlide: false,
    selectedVoice: 'Kore',
    isGeneratingTts: false,
    isGeneratingVideo: false,
    slideAudioElements: {},
    slideAudioUrls: {},
    slideVideoUrls: {},
    renderedMermaidSvg: '',
    speechSynthUtterance: null,

    // Lesson Modules & Guided Tutorials State
    activeModuleIndex: 0,
    revealedTutorialChecks: {},

    // Practice & Exam Simulator State
    activeProblemIndex: 0,
    selectedMcqOption: '',
    freeResponseDraft: '',
    revealedHintsCount: 0,
    showSolution: false,
    isGrading: false,
    gradingResultsByProblem: {},

    // Spaced Repetition Flashcards State
    currentCardIndex: 0,
    isCardFlipped: false,
    cardRatings: {}, // card_id -> 'again' | 'hard' | 'good' | 'easy'

    // Concept Graph State
    selectedGraphNode: null,
    graphSimulationAnimId: null,
    graphNodesState: [],
    graphEdgesState: [],
    isDraggingNode: null,

    // AI Tutor (Multi-turn Chat + Live Voice & Vision) State
    tutorSubMode: 'chat', // 'chat' | 'live'
    tutorPersona: 'socratic',
    chatMessages: [],
    chatInput: '',
    chatImageAttachment: null,
    chatImageName: '',
    lastInteractionId: null,
    isChatLoading: false,

    // Live Voice & Screen Tutor (Gemini 3.8 Live WebSocket)
    liveConnected: false,
    liveConnecting: false,
    liveStatusText: 'Ready for real-time voice & screen tutoring',
    liveTranscripts: [],
    liveTextDraft: '',
    liveWs: null,
    audioContextIn: null,
    audioContextOut: null,
    micStream: null,
    screenStream: null,
    screenIntervalId: null,
    nextPlayTime: 0,
    activeAudioSources: [],

    // ========================================================================
    // Modernality Interactive Problem Solver & Whiteboard Workbench State
    // (From sujaysun101/Modernality: Capture, Solution, Guided & Whiteboard)
    // ========================================================================
    wbMode: 'solution', // 'solution' | 'guided' | 'learning'
    wbProblemText: '',
    wbProblemImage: null,
    wbProblemMime: 'image/png',
    wbRecentProblems: JSON.parse(localStorage.getItem('modernality_recent_problems') || '[]'),
    wbIsAnalyzing: false,

    // Mode 1: Structured Solution Steps (Given / Find / Formula / Work / Note / Answer)
    wbSolutionData: null,
    wbCopiedStepIdx: null,

    // Mode 2: Socratic Guided Learning Step-by-Step
    wbGuidedStep: 1,
    wbGuidedTotalSteps: 6,
    wbGuidedHistory: [],
    wbGuidedInput: '',
    wbGuidedHint: '',
    wbGuidedLoading: false,
    wbGuidedListening: false,

    // Mode 3: Interactive Drawing Whiteboard + Live AI Demonstration
    wbTool: 'pen', // 'pen' | 'eraser' | 'circle' | 'square' | 'arrow' | 'text'
    wbColor: '#ffffff',
    wbColors: [
      { hex: '#ffffff', label: 'White (Default)' },
      { hex: '#3b82f6', label: 'Blue (Given)' },
      { hex: '#22c55e', label: 'Green (Formula)' },
      { hex: '#ef4444', label: 'Red (Answer)' },
      { hex: '#a855f7', label: 'Purple (Note)' },
      { hex: '#f59e0b', label: 'Amber (Highlight)' },
    ],
    wbSize: 4,
    wbShowGrid: true,
    wbStrokes: [],
    wbUndoStack: [],
    wbRedoStack: [],
    wbIsDrawing: false,
    wbCurrentPoints: [],
    wbShapeStart: null,

    // Whiteboard AI Demo Playback
    wbDemoData: null,
    wbDemoStepIndex: 0,
    wbDemoPlaying: false,
    wbDemoMuted: false,
    wbDemoSpeed: 1.0,
    wbDemoTimer: null,

    async init() {
      document.documentElement.setAttribute('data-theme', this.theme);
      await this.checkStatus();
      await Promise.all([
        this.fetchKitsList(),
        this.fetchSubjectsList(),
        this.fetchRecentProblems(),
      ]);
      if (this.kitsList.length > 0) {
        this.currentKitId = this.kitsList[0].id;
        await this.loadStudyKit(this.currentKitId);
        this.activeTab = 'flashcards';
      } else {
        this.currentKitId = '';
        this.currentKitRecord = null;
        this.activeTab = 'ingest';
        this.chatMessages = [
          {
            role: 'assistant',
            content: 'Welcome to **Modernality**! Create a Study Set from your materials or ask me any question right here.',
          },
        ];
      }

      this.$watch('currentSlideIndex', () => {
        this.stopSlidePlayback();
        this.renderCurrentSlideVisuals();
      });

      this.$watch('activeTab', (newTab) => {
        if (newTab === 'explainer') {
          this.$nextTick(() => this.renderCurrentSlideVisuals());
        } else if (newTab === 'graph') {
          this.$nextTick(() => this.initConceptGraphCanvas());
        } else if (newTab === 'workbench') {
          this.$nextTick(() => {
            if (this.wbMode === 'learning') this.initWhiteboardCanvas();
            this.typesetMath();
          });
        } else if (newTab === 'lessons' || newTab === 'practice' || newTab === 'tutorials') {
          this.$nextTick(() => this.typesetMath());
        }
      });
    },

    // ========================================================================
    // Computed Helpers
    // ========================================================================
    get hasActiveKit() {
      return !!(this.currentKitRecord && this.currentKitRecord.kit);
    },

    get kit() {
      return this.currentKitRecord?.kit || {
        title: 'No Study Kit Loaded — Ingest Your Materials to Begin',
        subject_area: 'Ready for Ingestion',
        executive_summary: '',
        explainer_slides: [],
        lesson_modules: [],
        guided_tutorial_steps: [],
        practice_problems: [],
        flashcards: [],
        concept_nodes: [],
        concept_edges: [],
      };
    },

    get sources() {
      return this.currentKitRecord?.sources || [];
    },

    get currentSlide() {
      const slides = this.kit.explainer_slides || [];
      return slides[this.currentSlideIndex] || null;
    },

    get currentModule() {
      const mods = this.kit.lesson_modules || [];
      return mods[this.activeModuleIndex] || null;
    },

    get currentProblem() {
      const probs = this.kit.practice_problems || [];
      return probs[this.activeProblemIndex] || null;
    },

    get currentFlashcard() {
      const cards = this.kit.flashcards || [];
      return cards[this.currentCardIndex] || null;
    },

    get masteredCardCount() {
      return Object.values(this.cardRatings).filter((r) => r === 'good' || r === 'easy').length;
    },

    get stillLearningCount() {
      return Object.values(this.cardRatings).filter((r) => r === 'again' || r === 'hard').length;
    },

    get filteredFlashcards() {
      const cards = this.kit.flashcards || [];
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (!q) return cards;
      return cards.filter(
        (c) =>
          (c.front || '').toLowerCase().includes(q) ||
          (c.back || '').toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q)
      );
    },

    get allSubjects() {
      const set = new Set(this.customSubjects);
      for (const k of this.kitsList) {
        if (k.subject_area && k.subject_area.trim()) {
          set.add(k.subject_area.trim());
        }
      }
      return Array.from(set);
    },

    get filteredKitsList() {
      let list = this.kitsList;
      if (this.selectedSubjectFilter !== 'ALL') {
        list = list.filter(
          (k) => (k.subject_area || '').toLowerCase() === this.selectedSubjectFilter.toLowerCase()
        );
      }
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (!q) return list;
      return list.filter(
        (k) =>
          (k.title || '').toLowerCase().includes(q) ||
          (k.subject_area || '').toLowerCase().includes(q)
      );
    },

    handleGlobalSpaceFlip(event) {
      if (this.activeTab !== 'flashcards' || !this.hasActiveKit) return;
      const tag = (event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;
      event.preventDefault();
      this.isCardFlipped = !this.isCardFlipped;
    },

    async speakTextAloud(rawText) {
      const clean = (rawText || '').replace(/[$*`#_~]/g, '').trim();
      if (!clean) return;
      if (this.elevenlabsConfigured) {
        try {
          const res = await fetch('/api/tts/elevenlabs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean, voice_id: this.elevenlabsVoice || 'Rachel' }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.audio_base64) {
              const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
              await audio.play();
              return;
            }
          }
        } catch (err) {
          console.warn('ElevenLabs card readout fallback:', err);
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(clean);
        window.speechSynthesis.speak(utter);
      }
    },

    async fetchSubjectsList() {
      try {
        const res = await fetch('/api/subjects');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.subjects)) {
            const merged = Array.from(new Set([...this.customSubjects, ...data.subjects]));
            this.customSubjects = merged;
            localStorage.setItem('modernality_subjects', JSON.stringify(merged));
          }
        }
      } catch (_) {}
    },

    async fetchRecentProblems() {
      try {
        const res = await fetch('/api/interactive/recent');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.problems) && data.problems.length > 0) {
            this.wbRecentProblems = data.problems;
          }
        }
      } catch (_) {}
    },

    async createSubjectFolder() {
      const name = this.newSubjectDraft.trim();
      if (!name) return;
      if (!this.customSubjects.includes(name)) {
        this.customSubjects.push(name);
        localStorage.setItem('modernality_subjects', JSON.stringify(this.customSubjects));
      }
      this.newSubjectDraft = '';
      this.showNewSubjectInput = false;
      this.selectSubjectFilter(name);
      try {
        await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } catch (_) {}
    },

    selectSubjectFilter(subj) {
      this.selectedSubjectFilter = subj;
      if (subj !== 'ALL') {
        this.ingestSubjectName = subj;
        const matching = this.kitsList.filter(
          (k) => (k.subject_area || '').toLowerCase() === subj.toLowerCase()
        );
        if (matching.length > 0) {
          if (!matching.some((m) => m.id === this.currentKitId)) {
            this.loadStudyKit(matching[0].id);
          }
        } else {
          // Empty subject folder selected: switch to ingest pre-populated with this subject
          this.currentKitId = '';
          this.currentKitRecord = null;
          this.activeTab = 'ingest';
        }
      }
    },

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('modernality_qz_theme', this.theme);
      document.documentElement.setAttribute('data-theme', this.theme);
      if (this.activeTab === 'graph' && this.hasActiveKit) {
        this.$nextTick(() => this.initConceptGraphCanvas());
      }
    },

    async deleteStudyKit(kitId) {
      if (!kitId) return;
      try {
        await fetch(`/api/kits/${kitId}`, { method: 'DELETE' });
        await this.fetchKitsList();
        if (this.kitsList.length > 0) {
          this.currentKitId = this.kitsList[0].id;
          await this.loadStudyKit(this.currentKitId);
        } else {
          this.currentKitId = '';
          this.currentKitRecord = null;
          this.activeTab = 'ingest';
        }
      } catch (err) {
        console.error('Delete kit failed:', err);
      }
    },

    // ========================================================================
    // Backend API & Kit Loading
    // ========================================================================
    async checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        this.apiKeyConfigured = !!data.api_key_configured;
        this.elevenlabsConfigured = !!data.elevenlabs_configured;
        if (data.gcp) {
          this.gcpStatus = data.gcp;
          if (data.gcp.project_id && !this.gcpProjectInput) {
            this.gcpProjectInput = data.gcp.project_id;
          }
          if (data.gcp.gcs_bucket_name && !this.gcpBucketInput) {
            this.gcpBucketInput = data.gcp.gcs_bucket_name;
          }
          if (data.gcp.firestore_database) {
            this.gcpFirestoreDbInput = data.gcp.firestore_database;
          }
          if (data.gcp.region) {
            this.gcpRegionInput = data.gcp.region;
          }
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    },

    async connectGcpBackend() {
      if (!this.gcpProjectInput.trim()) {
        this.errorBanner = 'Please enter a Google Cloud Project ID.';
        return;
      }
      this.isConnectingGcp = true;
      this.errorBanner = '';
      this.cloudSyncMessage = '';
      try {
        const res = await fetch('/api/cloud/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: this.gcpProjectInput.trim(),
            gcs_bucket_name: this.gcpBucketInput.trim() || `${this.gcpProjectInput.trim()}-lumina-media`,
            firestore_database: this.gcpFirestoreDbInput.trim() || '(default)',
            region: this.gcpRegionInput.trim() || 'us-east4',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to configure Google Cloud backend');
        this.gcpStatus = data.gcp;
        this.gcpBucketInput = this.gcpStatus.gcs_bucket_name || '';
        await this.fetchKitsList();
        this.cloudSyncMessage = this.gcpStatus.firestore_active
          ? 'Connected to Google Cloud Firestore & Storage!'
          : `Configured project '${this.gcpStatus.project_id}'. Run 'gcloud auth application-default login' if local ADC credentials are needed.`;
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.isConnectingGcp = false;
      }
    },

    async syncKitsWithFirestore() {
      this.isSyncingCloud = true;
      this.errorBanner = '';
      this.cloudSyncMessage = '';
      try {
        const res = await fetch('/api/cloud/sync', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Cloud sync failed');
        this.gcpStatus = data.gcp;
        await this.fetchKitsList();
        this.cloudSyncMessage = `Synced ${data.synced_kits} Study Kit(s) to Cloud Firestore (${this.gcpStatus.firestore_collection})!`;
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.isSyncingCloud = false;
      }
    },

    async saveApiKey() {
      if (!this.apiKeyInput.trim() && !this.elevenlabsKeyInput.trim() && !this.elevenlabsVoice) return;
      try {
        const res = await fetch('/api/config/api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: this.apiKeyInput.trim() || null,
            elevenlabs_api_key: this.elevenlabsKeyInput.trim() || null,
            elevenlabs_voice_id: this.elevenlabsVoice || 'Rachel',
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Invalid API key configuration');
        }
        const data = await res.json();
        this.apiKeyConfigured = !!data.api_key_configured;
        this.elevenlabsConfigured = !!data.elevenlabs_configured;
        this.showApiKeyModal = false;
        this.apiKeyInput = '';
        this.elevenlabsKeyInput = '';
        this.errorBanner = '';
      } catch (err) {
        this.errorBanner = err.message;
      }
    },

    async fetchKitsList() {
      try {
        const res = await fetch('/api/kits');
        this.kitsList = await res.json();
      } catch (err) {
        console.error('Failed to list kits:', err);
      }
    },

    async loadStudyKit(kitId) {
      try {
        this.stopSlidePlayback();
        const res = await fetch(`/api/kits/${kitId}`);
        if (!res.ok) throw new Error('Could not load study kit');
        const data = await res.json();
        this.currentKitId = kitId;
        this.currentKitRecord = data;
        this.currentSlideIndex = 0;
        this.activeModuleIndex = 0;
        this.activeProblemIndex = 0;
        this.currentCardIndex = 0;
        this.isCardFlipped = false;
        this.cardRatings = data.card_ratings || {};
        this.resetProblemView();

        // Hydrate saved slide media (TTS audio & Omni Flash video URLs)
        this.slideAudioUrls = {};
        this.slideVideoUrls = {};
        const savedMedia = data.slide_media || {};
        for (const [sNum, mObj] of Object.entries(savedMedia)) {
          if (mObj.audio_url) this.slideAudioUrls[sNum] = mObj.audio_url;
          if (mObj.video_url) this.slideVideoUrls[sNum] = mObj.video_url;
        }

        // Seed welcome chat message for this kit
        this.lastInteractionId = null;
        this.chatMessages = [
          {
            role: 'assistant',
            content: `Welcome to **${data.kit.title}**! I've analyzed all ${data.sources?.length || 1} source material(s).\n\nAsk me to break down any formula, quiz you Socratic-style, walk through an example, or attach a screenshot of a problem you're working on!`,
          },
        ];

        this.$nextTick(() => {
          this.renderCurrentSlideVisuals();
          this.typesetMath();
          if (this.activeTab === 'graph') this.initConceptGraphCanvas();
        });
      } catch (err) {
        this.errorBanner = err.message;
      }
    },

    // ========================================================================
    // Universal Ingestion & Synthesis
    // ========================================================================
    handleFileSelect(event) {
      const incoming = Array.from(event.target.files || []);
      this.selectedFiles = [...this.selectedFiles, ...incoming];
    },

    handleFileDrop(event) {
      event.preventDefault();
      const incoming = Array.from(event.dataTransfer?.files || []);
      this.selectedFiles = [...this.selectedFiles, ...incoming];
    },

    removeSelectedFile(idx) {
      this.selectedFiles.splice(idx, 1);
    },

    removeFile(idx) {
      this.selectedFiles.splice(idx, 1);
    },

    addUrlToList() {
      const trimmed = this.urlInput.trim();
      if (!trimmed) return;
      if (!this.addedUrls.includes(trimmed)) {
        this.addedUrls.push(trimmed);
      }
      this.urlInput = '';
    },

    addUrl() {
      this.addUrlToList();
    },

    removeUrlFromList(idx) {
      this.addedUrls.splice(idx, 1);
    },

    removeUrl(idx) {
      this.addedUrls.splice(idx, 1);
    },

    formatBytes(bytes) {
      if (!bytes) return '0 KB';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    },

    async synthesizeCourse() {
      if (
        this.selectedFiles.length === 0 &&
        this.addedUrls.length === 0 &&
        !this.urlInput.trim() &&
        !this.rawNotes.trim()
      ) {
        this.errorBanner = 'Please add at least one file, link, or study notes.';
        return;
      }

      if (this.urlInput.trim()) {
        this.addUrlToList();
      }

      this.errorBanner = '';
      this.isSynthesizing = true;
      this.synthesisStepText = 'Extracting sources & building flashcards, tests, and study guide...';

      const formData = new FormData();
      for (const file of this.selectedFiles) {
        formData.append('files', file);
      }
      formData.append('urls_json', JSON.stringify(this.addedUrls));
      formData.append('raw_notes', this.rawNotes);
      formData.append('custom_focus', this.customFocus);
      formData.append('subject_name', this.ingestSubjectName.trim());
      if (this.ingestMode === 'append_kit' && this.currentKitId) {
        formData.append('append_to_kit_id', this.currentKitId);
      }
      formData.append('use_deep_model', this.useDeepModel ? 'true' : 'false');

      const stepTimer = setTimeout(() => {
        if (this.isSynthesizing) {
          this.synthesisStepText =
            'Generating flashcards, practice test questions, and study modules...';
        }
      }, 3200);

      try {
        const res = await fetch('/api/ingest-and-synthesize', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Study set synthesis failed');
        }
        const newKitRecord = await res.json();
        await this.fetchKitsList();
        await this.loadStudyKit(newKitRecord.id);

        this.selectedFiles = [];
        this.addedUrls = [];
        this.rawNotes = '';
        this.activeTab = 'flashcards';
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        clearTimeout(stepTimer);
        this.isSynthesizing = false;
        this.synthesisStepText = '';
      }
    },

    // ========================================================================
    // Breakdown Explainer Video Player (Gemini TTS + Mermaid + KaTeX + Omni Video)
    // ========================================================================
    async renderCurrentSlideVisuals() {
      const slide = this.currentSlide;
      if (!slide) return;

      this.renderedMermaidSvg = '';
      if (slide.mermaid_diagram && window.mermaid) {
        try {
          const cleanCode = slide.mermaid_diagram.replace(/```mermaid|```/g, '').trim();
          const uniqueId = `mermaid_slide_${this.currentSlideIndex}_${Date.now()}`;
          const { svg } = await window.mermaid.render(uniqueId, cleanCode);
          this.renderedMermaidSvg = svg;
        } catch (err) {
          console.warn('Mermaid render fallback:', err);
          this.renderedMermaidSvg = '';
        }
      }
      this.$nextTick(() => this.typesetMath());
    },

    stopSlidePlayback() {
      this.isPlayingSlide = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      Object.values(this.slideAudioElements).forEach((audioEl) => {
        try {
          audioEl.pause();
          audioEl.currentTime = 0;
        } catch (_) {}
      });
    },

    async toggleSlidePlayback() {
      if (this.isPlayingSlide) {
        this.stopSlidePlayback();
        return;
      }
      const slide = this.currentSlide;
      if (!slide) return;

      const sKey = String(slide.slide_number);
      if (this.slideAudioUrls[sKey]) {
        this.playHtmlAudioUrl(sKey, this.slideAudioUrls[sKey]);
        return;
      }

      // If API key is configured, generate high-fidelity Gemini 3.8 Flash TTS audio; otherwise instant Web Speech
      if (this.apiKeyConfigured) {
        await this.generateGeminiSlideTts();
        if (this.slideAudioUrls[sKey]) {
          this.playHtmlAudioUrl(sKey, this.slideAudioUrls[sKey]);
          return;
        }
      }

      this.playBrowserSpeechFallback(slide.narration);
    },

    playHtmlAudioUrl(sKey, url) {
      this.stopSlidePlayback();
      const audio = new Audio(url);
      this.slideAudioElements[sKey] = audio;
      this.isPlayingSlide = true;
      audio.onended = () => {
        this.isPlayingSlide = false;
        // Auto-advance to next slide if available
        if (this.currentSlideIndex < (this.kit.explainer_slides?.length || 1) - 1) {
          this.currentSlideIndex++;
        }
      };
      audio.onerror = () => {
        this.isPlayingSlide = false;
      };
      audio.play();
    },

    playBrowserSpeechFallback(text) {
      if (!window.speechSynthesis) return;
      this.stopSlidePlayback();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      this.isPlayingSlide = true;
      utter.onend = () => {
        this.isPlayingSlide = false;
      };
      utter.onerror = () => {
        this.isPlayingSlide = false;
      };
      window.speechSynthesis.speak(utter);
    },

    async generateGeminiSlideTts() {
      const slide = this.currentSlide;
      if (!slide) return;
      if (!this.apiKeyConfigured) {
        this.showApiKeyModal = true;
        return;
      }
      this.isGeneratingTts = true;
      this.errorBanner = '';
      try {
        const res = await fetch('/api/generate/slide-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kit_id: this.currentKitId || 'general',
            slide_number: slide.slide_number,
            narration_text: slide.narration,
            voice_name: this.selectedVoice,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'TTS failed');
        }
        const data = await res.json();
        this.slideAudioUrls[String(slide.slide_number)] = data.audio_url;
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.isGeneratingTts = false;
      }
    },

    async generateGeminiSlideVideo() {
      const slide = this.currentSlide;
      if (!slide) return;
      if (!this.apiKeyConfigured) {
        this.showApiKeyModal = true;
        return;
      }
      this.isGeneratingVideo = true;
      this.errorBanner = '';
      try {
        const res = await fetch('/api/generate/slide-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kit_id: this.currentKitId || 'general',
            slide_number: slide.slide_number,
            visual_prompt: slide.visual_video_prompt,
            duration_seconds: 5,
            resolution: '720p',
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Omni Flash video generation failed');
        }
        const data = await res.json();
        this.slideVideoUrls[String(slide.slide_number)] = data.video_url;
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.isGeneratingVideo = false;
      }
    },

    // ========================================================================
    // Practice & Exam Simulator
    // ========================================================================
    selectProblem(idx) {
      this.activeProblemIndex = idx;
      this.resetProblemView();
      this.$nextTick(() => this.typesetMath());
    },

    resetProblemView() {
      this.selectedMcqOption = '';
      this.freeResponseDraft = '';
      this.revealedHintsCount = 0;
      this.showSolution = false;
    },

    revealNextHint() {
      const maxHints = this.currentProblem?.hints?.length || 0;
      if (this.revealedHintsCount < maxHints) {
        this.revealedHintsCount++;
        this.$nextTick(() => this.typesetMath());
      }
    },

    checkInstantMcq(option) {
      this.selectedMcqOption = option;
      const prob = this.currentProblem;
      if (!prob) return;
      const isRight = option.trim() === prob.correct_answer.trim();
      this.gradingResultsByProblem[prob.id] = {
        score: isRight ? 100 : 0,
        verdict: isRight ? 'Correct' : 'Needs Review',
        strengths: isRight ? ['Selected the exact right answer!'] : [],
        missing_or_incorrect: isRight
          ? []
          : [`You selected "${option}", whereas the correct answer is "${prob.correct_answer}".`],
        personalized_feedback: prob.step_by_step_solution,
        suggested_next_step: isRight
          ? 'Try the next higher-difficulty problem!'
          : 'Review the step-by-step derivation below.',
      };
      this.$nextTick(() => this.typesetMath());
    },

    get currentGradingResult() {
      const prob = this.currentProblem;
      if (!prob) return null;
      return this.gradingResultsByProblem[prob.id] || null;
    },

    async submitPracticeAnswer() {
      await this.submitAnswerForAiGrading();
    },

    async submitAnswerForAiGrading() {
      const prob = this.currentProblem;
      if (!prob) return;
      const answerText =
        prob.question_type === 'multiple_choice'
          ? `${this.selectedMcqOption}\n${this.freeResponseDraft}`.trim()
          : this.freeResponseDraft.trim();

      if (!answerText) return;

      this.isGrading = true;
      this.errorBanner = '';
      try {
        const res = await fetch('/api/practice/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kit_id: this.currentKitId || 'general',
            problem_id: prob.id,
            student_answer: answerText,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Grading failed');
        }
        const gradeData = await res.json();
        this.gradingResultsByProblem[prob.id] = gradeData;
        this.$nextTick(() => this.typesetMath());
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.isGrading = false;
      }
    },

    // ========================================================================
    // Spaced Repetition Flashcards
    // ========================================================================
    flipCard() {
      this.isCardFlipped = !this.isCardFlipped;
      this.$nextTick(() => this.typesetMath());
    },

    rateFlashcard(rating) {
      this.rateCurrentCard(rating);
    },

    rateCurrentCard(rating) {
      const card = this.currentFlashcard;
      if (!card) return;
      this.cardRatings = { ...this.cardRatings, [card.id]: rating };
      if (this.currentKitId) {
        fetch(`/api/kits/${this.currentKitId}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_ratings: this.cardRatings }),
        }).catch(() => {});
      }
      this.isCardFlipped = false;
      setTimeout(() => {
        if (this.currentCardIndex < (this.kit.flashcards?.length || 1) - 1) {
          this.currentCardIndex++;
        } else {
          this.currentCardIndex = 0;
        }
        this.$nextTick(() => this.typesetMath());
      }, 180);
    },

    // ========================================================================
    // Interactive Force-Directed Knowledge Graph Canvas
    // ========================================================================
    initConceptGraphCanvas() {
      const canvas = document.getElementById('conceptGraphCanvas');
      if (!canvas) return;
      if (this.graphSimulationAnimId) {
        cancelAnimationFrame(this.graphSimulationAnimId);
      }

      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width || 800;
      canvas.height = 520;

      const rawNodes = this.kit.concept_nodes || [];
      const rawEdges = this.kit.concept_edges || [];

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      this.graphNodesState = rawNodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, rawNodes.length);
        const radius = Math.min(canvas.width, canvas.height) * 0.32;
        return {
          ...n,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          vx: 0,
          vy: 0,
          r: n.category === 'core' ? 26 : 20,
        };
      });

      this.graphEdgesState = rawEdges.map((e) => ({ ...e }));
      if (this.graphNodesState.length > 0 && !this.selectedGraphNode) {
        this.selectedGraphNode = this.graphNodesState[0];
      }

      const ctx = canvas.getContext('2d');

      const getPointerPos = (evt) => {
        const r = canvas.getBoundingClientRect();
        return {
          x: evt.clientX - r.left,
          y: evt.clientY - r.top,
        };
      };

      canvas.onmousedown = (evt) => {
        const pos = getPointerPos(evt);
        const hit = this.graphNodesState.find(
          (n) => Math.hypot(n.x - pos.x, n.y - pos.y) <= n.r + 8
        );
        if (hit) {
          this.selectedGraphNode = hit;
          this.isDraggingNode = hit;
        }
      };

      canvas.onmousemove = (evt) => {
        if (!this.isDraggingNode) return;
        const pos = getPointerPos(evt);
        this.isDraggingNode.x = pos.x;
        this.isDraggingNode.y = pos.y;
        this.isDraggingNode.vx = 0;
        this.isDraggingNode.vy = 0;
      };

      canvas.onmouseup = () => {
        this.isDraggingNode = null;
      };

      const categoryColors = {
        core: '#6366f1',
        prerequisite: '#06b6d4',
        application: '#10b981',
        detail: '#f59e0b',
      };

      const tick = () => {
        const nodes = this.graphNodesState;
        const edges = this.graphEdgesState;

        // Physics repulsion & spring attraction
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const distSq = Math.max(400, dx * dx + dy * dy);
            const force = 3800 / distSq;
            const dist = Math.sqrt(distSq);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        for (const edge of edges) {
          const s = nodes.find((n) => n.id === edge.source);
          const t = nodes.find((n) => n.id === edge.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const targetLen = 155;
          const spring = (dist - targetLen) * 0.018;
          const fx = (dx / dist) * spring;
          const fy = (dy / dist) * spring;
          s.vx += fx;
          s.vy += fy;
          t.vx -= fx;
          t.vy -= fy;
        }

        for (const n of nodes) {
          if (n === this.isDraggingNode) continue;
          // Gentle centering gravity
          n.vx += (cx - n.x) * 0.004;
          n.vy += (cy - n.y) * 0.004;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x = Math.max(55, Math.min(canvas.width - 55, n.x + n.vx));
          n.y = Math.max(45, Math.min(canvas.height - 45, n.y + n.vy));
        }

        // Render
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Edges
        for (const edge of edges) {
          const s = nodes.find((n) => n.id === edge.source);
          const t = nodes.find((n) => n.id === edge.target);
          if (!s || !t) continue;

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Edge label at midpoint
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2;
          ctx.font = '500 10px Plus Jakarta Sans, sans-serif';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.textAlign = 'center';
          ctx.fillText(edge.relationship || '', mx, my - 4);
        }

        // Draw Nodes
        for (const n of nodes) {
          const isSelected = this.selectedGraphNode && this.selectedGraphNode.id === n.id;
          const color = categoryColors[n.category] || '#6366f1';

          if (isSelected) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(99, 102, 241, 0.28)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.35)';
          ctx.stroke();

          ctx.font = '600 12px Plus Jakarta Sans, sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + n.r + 16);
        }

        if (this.activeTab === 'graph') {
          this.graphSimulationAnimId = requestAnimationFrame(tick);
        }
      };

      tick();
    },

    // ========================================================================
    // Multi-Turn AI Tutor Chat
    // ========================================================================
    handleChatImageAttach(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.chatImageName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        this.chatImageAttachment = {
          b64: reader.result,
          mime: file.type || 'image/jpeg',
        };
      };
      reader.readAsDataURL(file);
    },

    async sendTutorChatMessage(quickPrompt = null) {
      const text = (quickPrompt || this.chatInput).trim();
      if (!text && !this.chatImageAttachment) return;

      const attachedImg = this.chatImageAttachment;
      this.chatMessages.push({
        role: 'user',
        content: text || '[Shared an image for analysis]',
        imagePreview: attachedImg?.b64 || null,
      });

      this.chatInput = '';
      this.chatImageAttachment = null;
      this.chatImageName = '';
      this.isChatLoading = true;

      this.$nextTick(() => {
        const container = document.getElementById('tutorChatScroll');
        if (container) container.scrollTop = container.scrollHeight;
      });

      try {
        const res = await fetch('/api/tutor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kit_id: this.currentKitId || 'general',
            message: text || 'Please explain the attached image/problem step by step.',
            previous_interaction_id: this.lastInteractionId,
            persona_mode: this.tutorPersona,
            image_b64: attachedImg?.b64 || null,
            image_mime: attachedImg?.mime || 'image/jpeg',
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Chat request failed');
        }
        const data = await res.json();
        this.lastInteractionId = data.interaction_id;
        this.chatMessages.push({
          role: 'assistant',
          content: data.reply,
        });
        this.$nextTick(() => {
          this.typesetMath();
          const container = document.getElementById('tutorChatScroll');
          if (container) container.scrollTop = container.scrollHeight;
        });
      } catch (err) {
        this.chatMessages.push({
          role: 'assistant',
          content: `⚠️ **Error**: ${err.message}`,
        });
      } finally {
        this.isChatLoading = false;
      }
    },

    // ========================================================================
    // Gemini 3.8 Live Voice & Screen Tutor (Bidirectional WebSocket)
    // ========================================================================
    async toggleLiveVoiceSession() {
      if (this.liveConnected || this.liveConnecting) {
        this.stopLiveVoiceSession();
        return;
      }
      if (!this.apiKeyConfigured) {
        this.showApiKeyModal = true;
        return;
      }

      this.liveConnecting = true;
      this.liveStatusText = 'Connecting to Gemini 3.8 Live...';

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/live-tutor/${this.currentKitId || 'general'}`;
      this.liveWs = new WebSocket(wsUrl);

      this.liveWs.onopen = async () => {
        this.liveConnected = true;
        this.liveConnecting = false;
        this.liveStatusText = 'Live Mic Active — Speak naturally to Lumina';
        await this.startMicrophoneCapture();
      };

      this.liveWs.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'connected') {
          this.liveStatusText =
            msg.voice_provider === 'elevenlabs'
              ? 'Live Voice active (ElevenLabs API)'
              : 'Live Voice active';
        } else if (msg.type === 'audio' && msg.data) {
          this.playPcm24kChunk(msg.data);
        } else if (msg.type === 'elevenlabs_mp3' && msg.data) {
          this.playElevenLabsMp3Base64(msg.data);
        } else if (msg.type === 'input_transcript') {
          this.liveTranscripts.push({ role: 'You', text: msg.text });
        } else if (msg.type === 'output_transcript') {
          this.liveTranscripts.push({ role: 'Modernality', text: msg.text });
        } else if (msg.type === 'interrupted') {
          this.clearLiveAudioPlaybackQueue();
        } else if (msg.type === 'error') {
          this.liveStatusText = `Error: ${msg.message}`;
        }
      };

      this.liveWs.onclose = () => {
        this.stopLiveVoiceSession();
      };
    },

    async startMicrophoneCapture() {
      try {
        this.audioContextOut = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000,
        });
        this.nextPlayTime = this.audioContextOut.currentTime;

        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        this.audioContextIn = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000,
        });
        const source = this.audioContextIn.createMediaStreamSource(this.micStream);
        const processor = this.audioContextIn.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (!this.liveConnected || !this.liveWs || this.liveWs.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const bytes = new Uint8Array(int16.buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          this.liveWs.send(
            JSON.stringify({
              type: 'audio',
              data: btoa(binary),
            })
          );
        };

        source.connect(processor);
        processor.connect(this.audioContextIn.destination);
      } catch (err) {
        this.liveStatusText = `Mic access note: ${err.message}. You can still send text or screen frames below!`;
      }
    },

    playPcm24kChunk(base64Pcm) {
      if (!this.audioContextOut) return;
      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.audioContextOut.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioContextOut.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContextOut.destination);

      const startAt = Math.max(this.audioContextOut.currentTime, this.nextPlayTime);
      source.start(startAt);
      this.nextPlayTime = startAt + audioBuffer.duration;
      this.activeAudioSources.push(source);
    },

    async playElevenLabsMp3Base64(base64Mp3) {
      try {
        if (!this.audioContextOut) {
          this.audioContextOut = new (window.AudioContext || window.webkitAudioContext)();
          this.nextPlayTime = this.audioContextOut.currentTime;
        }
        const binary = atob(base64Mp3);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const audioBuffer = await this.audioContextOut.decodeAudioData(bytes.buffer.slice(0));
        const source = this.audioContextOut.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContextOut.destination);
        const startAt = Math.max(this.audioContextOut.currentTime, this.nextPlayTime);
        source.start(startAt);
        this.nextPlayTime = startAt + audioBuffer.duration;
        this.activeAudioSources.push(source);
      } catch (err) {
        console.error('ElevenLabs MP3 playback error:', err);
      }
    },

    clearLiveAudioPlaybackQueue() {
      this.activeAudioSources.forEach((src) => {
        try {
          src.stop();
        } catch (_) {}
      });
      this.activeAudioSources = [];
      if (this.audioContextOut) {
        this.nextPlayTime = this.audioContextOut.currentTime;
      }
    },

    async toggleLiveScreenShare() {
      if (this.screenStream) {
        this.stopScreenShare();
        return;
      }
      if (!this.liveConnected) {
        await this.toggleLiveVoiceSession();
      }
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 2 },
        });
        const videoEl = document.getElementById('liveScreenPreview');
        if (videoEl) {
          videoEl.srcObject = this.screenStream;
          videoEl.play();
        }
        const offCanvas = document.createElement('canvas');
        const ctx = offCanvas.getContext('2d');

        this.screenIntervalId = setInterval(() => {
          if (!this.liveConnected || !this.screenStream || !videoEl.videoWidth) return;
          offCanvas.width = Math.min(1024, videoEl.videoWidth);
          offCanvas.height = Math.round(
            (offCanvas.width / videoEl.videoWidth) * videoEl.videoHeight
          );
          ctx.drawImage(videoEl, 0, 0, offCanvas.width, offCanvas.height);
          const jpegDataUrl = offCanvas.toDataURL('image/jpeg', 0.72);
          if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
            this.liveWs.send(
              JSON.stringify({
                type: 'video',
                data: jpegDataUrl,
                mime_type: 'image/jpeg',
              })
            );
          }
        }, 2000);
      } catch (err) {
        console.warn('Screen share cancelled:', err);
      }
    },

    stopScreenShare() {
      if (this.screenIntervalId) {
        clearInterval(this.screenIntervalId);
        this.screenIntervalId = null;
      }
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;
      }
    },

    sendLiveTextPrompt() {
      if (!this.liveTextDraft.trim() || !this.liveWs || this.liveWs.readyState !== WebSocket.OPEN) return;
      const text = this.liveTextDraft.trim();
      this.liveTranscripts.push({ role: 'You', text });
      this.liveWs.send(JSON.stringify({ type: 'text', text }));
      this.liveTextDraft = '';
    },

    stopLiveVoiceSession() {
      this.liveConnected = false;
      this.liveConnecting = false;
      this.liveStatusText = 'Live session ended';
      this.stopScreenShare();
      this.clearLiveAudioPlaybackQueue();

      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }
      if (this.audioContextIn) {
        this.audioContextIn.close().catch(() => {});
        this.audioContextIn = null;
      }
      if (this.audioContextOut) {
        this.audioContextOut.close().catch(() => {});
        this.audioContextOut = null;
      }
      if (this.liveWs) {
        try {
          this.liveWs.close();
        } catch (_) {}
        this.liveWs = null;
      }
    },

    // ========================================================================
    // Modernality Interactive Problem Solver & Whiteboard Methods
    // ========================================================================
    async captureScreenProblem() {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        stream.getTracks().forEach((t) => t.stop());
        this.wbProblemImage = canvas.toDataURL('image/png');
        this.wbProblemMime = 'image/png';
      } catch (err) {
        console.warn('Screen capture cancelled:', err);
      }
    },

    async pasteClipboardProblem() {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const reader = new FileReader();
              reader.onload = (ev) => {
                this.wbProblemImage = ev.target.result;
                this.wbProblemMime = type;
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
        const txt = await navigator.clipboard.readText();
        if (txt && txt.trim()) {
          this.wbProblemText = txt.trim();
        }
      } catch (_) {
        try {
          const txt = await navigator.clipboard.readText();
          if (txt && txt.trim()) this.wbProblemText = txt.trim();
        } catch (e) {
          this.errorBanner = 'Press Ctrl+V or use Load Image to attach your problem.';
        }
      }
    },

    handleWbImageUpload(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.wbProblemImage = ev.target.result;
        this.wbProblemMime = file.type || 'image/png';
      };
      reader.readAsDataURL(file);
    },

    handleWbImageDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.wbProblemImage = ev.target.result;
          this.wbProblemMime = file.type || 'image/png';
        };
        reader.readAsDataURL(file);
      }
    },

    openPracticeProblemInWorkbench(prob) {
      if (!prob) return;
      this.wbProblemText = prob.question || '';
      this.wbProblemImage = null;
      this.wbSolutionData = null;
      this.wbDemoData = null;
      this.wbGuidedHistory = [];
      this.activeTab = 'workbench';
      this.runWorkbenchMode(this.wbMode);
    },

    selectRecentWbProblem(item) {
      this.wbProblemText = item.text || '';
      this.wbProblemImage = item.image || null;
      this.wbSolutionData = null;
      this.wbDemoData = null;
      this.wbGuidedHistory = [];
      this.runWorkbenchMode(this.wbMode);
    },

    switchWbMode(mode) {
      this.wbMode = mode;
      this.stopWbDemoPlayback();
      if (mode === 'learning') {
        this.$nextTick(() => this.initWhiteboardCanvas());
      }
      if ((this.wbProblemText.trim() || this.wbProblemImage) && !this.wbIsAnalyzing) {
        if (mode === 'solution' && !this.wbSolutionData) this.runWorkbenchMode('solution');
        if (mode === 'guided' && this.wbGuidedHistory.length === 0) this.runWorkbenchMode('guided');
        if (mode === 'learning' && !this.wbDemoData) this.runWorkbenchMode('learning');
      }
    },

    async runWorkbenchMode(targetMode) {
      const mode = targetMode || this.wbMode;
      if (!this.wbProblemText.trim() && !this.wbProblemImage) {
        this.errorBanner = 'Capture a screen problem, upload/paste an image, or enter a problem statement first.';
        return;
      }

      // Save to Recent Problems
      const previewLabel = this.wbProblemText.trim().slice(0, 70) || 'Captured Screen Problem';
      this.wbRecentProblems = [
        {
          id: Date.now().toString(),
          label: previewLabel,
          text: this.wbProblemText,
          image: this.wbProblemImage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...this.wbRecentProblems.filter((p) => p.label !== previewLabel).slice(0, 7),
      ];
      try {
        localStorage.setItem('modernality_recent_problems', JSON.stringify(this.wbRecentProblems.slice(0, 5)));
        fetch('/api/interactive/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.wbRecentProblems[0]),
        }).catch(() => {});
      } catch (_) {}

      this.wbIsAnalyzing = true;
      this.errorBanner = '';

      try {
        if (mode === 'solution') {
          const res = await fetch('/api/interactive/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              problem_text: this.wbProblemText,
              image_b64: this.wbProblemImage,
              image_mime: this.wbProblemMime,
              kit_id: this.currentKitId || null,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).detail || 'Failed to solve problem');
          this.wbSolutionData = await res.json();
          this.$nextTick(() => this.typesetMath());
        } else if (mode === 'guided') {
          this.wbGuidedStep = 1;
          this.wbGuidedHistory = [];
          const res = await fetch('/api/interactive/guided', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              problem_text: this.wbProblemText,
              conversation_history: [],
              current_step: 1,
              total_steps: this.wbGuidedTotalSteps,
              image_b64: this.wbProblemImage,
              image_mime: this.wbProblemMime,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).detail || 'Failed to start guided session');
          const data = await res.json();
          this.wbGuidedHistory = [{ role: 'ai', content: data.content, type: 'question' }];
          this.wbGuidedHint = data.next_guiding_hint || '';
          this.$nextTick(() => this.typesetMath());
        } else if (mode === 'learning') {
          const res = await fetch('/api/interactive/whiteboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              problem_text: this.wbProblemText,
              image_b64: this.wbProblemImage,
              image_mime: this.wbProblemMime,
              kit_id: this.currentKitId || null,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).detail || 'Failed to prepare whiteboard demo');
          this.wbDemoData = await res.json();
          this.wbDemoStepIndex = 0;
          this.$nextTick(() => {
            this.initWhiteboardCanvas();
            this.typesetMath();
          });
        }
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.wbIsAnalyzing = false;
      }
    },

    async copySolutionStep(step, idx) {
      try {
        await navigator.clipboard.writeText(step.content);
        this.wbCopiedStepIdx = idx;
        setTimeout(() => {
          if (this.wbCopiedStepIdx === idx) this.wbCopiedStepIdx = null;
        }, 1800);
      } catch (_) {}
    },

    exportInteractiveSolution() {
      if (!this.wbSolutionData?.steps) return;
      const text = this.wbSolutionData.steps
        .map((s, idx) => `Step ${idx + 1} [${(s.type || 'work').toUpperCase()}]:\n${s.content}${s.explanation ? `\nReasoning: ${s.explanation}` : ''}`)
        .join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modernality-solution-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    },

    async sendWbGuidedReply() {
      const msg = this.wbGuidedInput.trim();
      if (!msg || this.wbGuidedLoading) return;
      this.wbGuidedInput = '';
      this.wbGuidedHistory.push({ role: 'user', content: msg, type: 'answer' });
      this.wbGuidedLoading = true;
      try {
        const res = await fetch('/api/interactive/guided', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem_text: this.wbProblemText,
            conversation_history: this.wbGuidedHistory.map((m) => ({ role: m.role, content: m.content })),
            current_step: this.wbGuidedStep,
            total_steps: this.wbGuidedTotalSteps,
            image_b64: this.wbProblemImage,
            image_mime: this.wbProblemMime,
          }),
        });
        if (!res.ok) throw new Error('Guided learning step failed');
        const data = await res.json();
        this.wbGuidedHistory.push({
          role: 'ai',
          content: data.content,
          type: data.reply_type || 'feedback',
          isCorrect: data.is_correct,
        });
        if (data.is_correct && this.wbGuidedStep < this.wbGuidedTotalSteps) {
          this.wbGuidedStep++;
        }
        if (data.next_guiding_hint) {
          this.wbGuidedHint = data.next_guiding_hint;
        }
        this.$nextTick(() => {
          this.typesetMath();
          const el = document.getElementById('wbGuidedScroll');
          if (el) el.scrollTop = el.scrollHeight;
        });
      } catch (err) {
        this.errorBanner = err.message;
      } finally {
        this.wbGuidedLoading = false;
      }
    },

    revealWbGuidedHint() {
      const hintText =
        this.wbGuidedHint ||
        'Think about what fundamental formula or conservation relation connects the given quantities to the unknown.';
      this.wbGuidedHistory.push({
        role: 'ai',
        content: `**Hint:** ${hintText}`,
        type: 'hint',
      });
      this.$nextTick(() => this.typesetMath());
    },

    toggleWbGuidedVoiceMic() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        this.errorBanner = 'Browser speech recognition is not supported in this browser.';
        return;
      }
      if (this.wbGuidedListening) {
        this.wbGuidedListening = false;
        return;
      }
      const rec = new SpeechRec();
      rec.lang = 'en-US';
      rec.interimResults = false;
      this.wbGuidedListening = true;
      rec.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          this.wbGuidedInput = this.wbGuidedInput ? `${this.wbGuidedInput} ${transcript}` : transcript;
        }
      };
      rec.onend = () => {
        this.wbGuidedListening = false;
      };
      rec.start();
    },

    // ========================================================================
    // Interactive Drawing Whiteboard Canvas (Pen, Eraser, Shapes, Text, Demo)
    // ========================================================================
    initWhiteboardCanvas() {
      const canvas = document.getElementById('modernalityWhiteboardCanvas');
      if (!canvas) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = (rect.width || 800) * dpr;
      canvas.height = (rect.height || 440) * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      this.redrawWhiteboard();
    },

    redrawWhiteboard() {
      const canvas = document.getElementById('modernalityWhiteboardCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      if (this.wbShowGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 24;
        for (let x = 0; x <= width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // Draw AI Demo Steps on top-left of board if present
      if (this.wbDemoData?.steps?.length) {
        const visibleSteps = this.wbDemoData.steps.slice(0, this.wbDemoStepIndex + 1);
        let yCursor = 28;
        visibleSteps.forEach((st, idx) => {
          const isCurrent = idx === this.wbDemoStepIndex;
          const colorMap = {
            given: '#60a5fa',
            formula: '#4ade80',
            work: '#e2e8f0',
            note: '#c084fc',
            answer: '#f87171',
          };
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.fillStyle = colorMap[st.step_type] || '#818cf8';
          ctx.fillText(`STEP ${idx + 1} • ${(st.board_heading || st.step_type || '').toUpperCase()}`, 24, yCursor);
          yCursor += 18;

          ctx.font = isCurrent ? '700 15px "Plus Jakarta Sans", sans-serif' : '500 14px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = isCurrent ? '#ffffff' : '#94a3b8';
          const textLine = (st.board_equation_or_text || '').replace(/\$/g, '');
          ctx.fillText(textLine.slice(0, 95), 24, yCursor);
          yCursor += 30;
        });
      }

      // Draw User Strokes
      for (const stroke of this.wbStrokes) {
        ctx.strokeStyle = stroke.tool === 'eraser' ? '#0b0f19' : stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.tool === 'text' && stroke.text) {
          ctx.font = `${12 + stroke.size * 2}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillText(stroke.text, stroke.x, stroke.y);
        } else if (stroke.tool === 'circle' && stroke.start && stroke.end) {
          const rx = Math.hypot(stroke.end.x - stroke.start.x, stroke.end.y - stroke.start.y);
          ctx.beginPath();
          ctx.arc(stroke.start.x, stroke.start.y, rx, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stroke.tool === 'square' && stroke.start && stroke.end) {
          ctx.strokeRect(
            stroke.start.x,
            stroke.start.y,
            stroke.end.x - stroke.start.x,
            stroke.end.y - stroke.start.y
          );
        } else if (stroke.tool === 'arrow' && stroke.start && stroke.end) {
          const headlen = 10;
          const angle = Math.atan2(stroke.end.y - stroke.start.y, stroke.end.x - stroke.start.x);
          ctx.beginPath();
          ctx.moveTo(stroke.start.x, stroke.start.y);
          ctx.lineTo(stroke.end.x, stroke.end.y);
          ctx.lineTo(
            stroke.end.x - headlen * Math.cos(angle - Math.PI / 6),
            stroke.end.y - headlen * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(stroke.end.x, stroke.end.y);
          ctx.lineTo(
            stroke.end.x - headlen * Math.cos(angle + Math.PI / 6),
            stroke.end.y - headlen * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        } else if (stroke.points?.length) {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (const pt of stroke.points) {
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }
    },

    wbPointerDown(e) {
      const canvas = document.getElementById('modernalityWhiteboardCanvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (this.wbTool === 'text') {
        const label = prompt('Enter text or formula to place on whiteboard:');
        if (label && label.trim()) {
          this.wbUndoStack.push([...this.wbStrokes]);
          this.wbRedoStack = [];
          this.wbStrokes.push({
            tool: 'text',
            text: label.trim(),
            x: pos.x,
            y: pos.y,
            color: this.wbColor,
            size: this.wbSize,
          });
          this.redrawWhiteboard();
        }
        return;
      }

      this.wbIsDrawing = true;
      this.wbShapeStart = pos;
      this.wbCurrentPoints = [pos];
    },

    wbPointerMove(e) {
      if (!this.wbIsDrawing) return;
      const canvas = document.getElementById('modernalityWhiteboardCanvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (this.wbTool === 'pen' || this.wbTool === 'eraser') {
        this.wbCurrentPoints.push(pos);
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = this.wbTool === 'eraser' ? '#0b0f19' : this.wbColor;
        ctx.lineWidth = this.wbTool === 'eraser' ? this.wbSize * 3 : this.wbSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const pts = this.wbCurrentPoints;
        if (pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      } else {
        this.redrawWhiteboard();
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = this.wbColor;
        ctx.lineWidth = this.wbSize;
        if (this.wbTool === 'circle') {
          const rx = Math.hypot(pos.x - this.wbShapeStart.x, pos.y - this.wbShapeStart.y);
          ctx.beginPath();
          ctx.arc(this.wbShapeStart.x, this.wbShapeStart.y, rx, 0, Math.PI * 2);
          ctx.stroke();
        } else if (this.wbTool === 'square') {
          ctx.strokeRect(
            this.wbShapeStart.x,
            this.wbShapeStart.y,
            pos.x - this.wbShapeStart.x,
            pos.y - this.wbShapeStart.y
          );
        } else if (this.wbTool === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(this.wbShapeStart.x, this.wbShapeStart.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
    },

    wbPointerUp(e) {
      if (!this.wbIsDrawing) return;
      this.wbIsDrawing = false;
      const canvas = document.getElementById('modernalityWhiteboardCanvas');
      const rect = canvas.getBoundingClientRect();
      const endPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      this.wbUndoStack.push([...this.wbStrokes]);
      this.wbRedoStack = [];

      if (this.wbTool === 'pen' || this.wbTool === 'eraser') {
        this.wbStrokes.push({
          tool: this.wbTool,
          points: [...this.wbCurrentPoints],
          color: this.wbColor,
          size: this.wbTool === 'eraser' ? this.wbSize * 3 : this.wbSize,
        });
      } else {
        this.wbStrokes.push({
          tool: this.wbTool,
          start: this.wbShapeStart,
          end: endPos,
          color: this.wbColor,
          size: this.wbSize,
        });
      }
      this.wbCurrentPoints = [];
      this.redrawWhiteboard();
    },

    wbUndo() {
      if (this.wbUndoStack.length === 0) return;
      this.wbRedoStack.push([...this.wbStrokes]);
      this.wbStrokes = this.wbUndoStack.pop();
      this.redrawWhiteboard();
    },

    wbRedo() {
      if (this.wbRedoStack.length === 0) return;
      this.wbUndoStack.push([...this.wbStrokes]);
      this.wbStrokes = this.wbRedoStack.pop();
      this.redrawWhiteboard();
    },

    wbClearCanvas() {
      this.wbUndoStack.push([...this.wbStrokes]);
      this.wbRedoStack = [];
      this.wbStrokes = [];
      this.redrawWhiteboard();
    },

    toggleWbDemoPlayback() {
      if (this.wbDemoPlaying) {
        this.stopWbDemoPlayback();
      } else {
        this.startWbDemoPlayback();
      }
    },

    startWbDemoPlayback() {
      if (!this.wbDemoData?.steps?.length) return;
      this.wbDemoPlaying = true;
      this.playCurrentWbDemoStepVoice();
    },

    async playCurrentWbDemoStepVoice() {
      if (!this.wbDemoPlaying || !this.wbDemoData?.steps?.length) return;
      this.redrawWhiteboard();
      this.$nextTick(() => this.typesetMath());

      const step = this.wbDemoData.steps[this.wbDemoStepIndex];
      if (!step) {
        this.wbDemoPlaying = false;
        return;
      }

      const advanceNextStep = () => {
        if (!this.wbDemoPlaying) return;
        if (this.wbDemoStepIndex < this.wbDemoData.steps.length - 1) {
          this.wbDemoStepIndex++;
          this.playCurrentWbDemoStepVoice();
        } else {
          this.wbDemoPlaying = false;
        }
      };

      if (!this.wbDemoMuted && step.narration && this.elevenlabsConfigured) {
        try {
          const res = await fetch('/api/tts/elevenlabs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: step.narration,
              voice_id: this.elevenlabsVoice || 'Rachel',
            }),
          });
          if (res.ok && this.wbDemoPlaying) {
            const data = await res.json();
            if (data.audio_base64) {
              if (this.wbDemoAudioEl) {
                this.wbDemoAudioEl.pause();
                this.wbDemoAudioEl = null;
              }
              const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
              audio.playbackRate = this.wbDemoSpeed || 1.0;
              audio.onended = () => advanceNextStep();
              this.wbDemoAudioEl = audio;
              await audio.play();
              return;
            }
          }
        } catch (err) {
          console.warn('ElevenLabs whiteboard narration fallback:', err);
        }
      }

      if (!this.wbDemoMuted && 'speechSynthesis' in window && step.narration) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(step.narration);
        utter.rate = this.wbDemoSpeed || 1.0;
        utter.onend = () => advanceNextStep();
        window.speechSynthesis.speak(utter);
      } else {
        clearTimeout(this.wbDemoTimer);
        this.wbDemoTimer = setTimeout(() => advanceNextStep(), 6000 / (this.wbDemoSpeed || 1.0));
      }
    },

    stopWbDemoPlayback() {
      this.wbDemoPlaying = false;
      clearTimeout(this.wbDemoTimer);
      if (this.wbDemoAudioEl) {
        this.wbDemoAudioEl.pause();
        this.wbDemoAudioEl = null;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },

    stepWbDemo(delta) {
      if (!this.wbDemoData?.steps?.length) return;
      this.stopWbDemoPlayback();
      const next = Math.max(0, Math.min(this.wbDemoData.steps.length - 1, this.wbDemoStepIndex + delta));
      this.wbDemoStepIndex = next;
      this.redrawWhiteboard();
      this.$nextTick(() => this.typesetMath());
    },

    askTutorToReviewWhiteboard() {
      const canvas = document.getElementById('modernalityWhiteboardCanvas');
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      this.chatImageAttachment = { dataUrl, mime: 'image/png' };
      this.chatImageName = 'whiteboard-work.png';
      this.activeTab = 'tutor';
      this.tutorSubMode = 'chat';
      this.sendTutorChatMessage(
        `Please review my handwritten steps on the whiteboard${
          this.wbProblemText ? ` for the problem: "${this.wbProblemText}"` : ''
        } and let me know if my reasoning is on track!`
      );
    },

    // ========================================================================
    // Markdown + KaTeX Rendering Helpers
    // ========================================================================
    renderMarkdown(mdText) {
      if (!mdText) return '';
      if (window.marked) {
        return window.marked.parse(mdText);
      }
      return mdText.replace(/\n/g, '<br>');
    },

    renderFormulaHtml(formulaStr) {
      if (!formulaStr) return '';
      if (window.katex) {
        try {
          return window.katex.renderToString(formulaStr, {
            displayMode: true,
            throwOnError: false,
          });
        } catch (_) {
          return `<code>${formulaStr}</code>`;
        }
      }
      return `<code>${formulaStr}</code>`;
    },

    typesetMath() {
      if (window.renderMathInElement) {
        try {
          window.renderMathInElement(document.body, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true },
            ],
            throwOnError: false,
          });
        } catch (_) {}
      }
    },
  }));
});
