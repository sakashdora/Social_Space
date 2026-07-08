# Product Requirements Document (PRD) - Veil Shine

## 1. Introduction

Veil Shine is an innovative, AI-powered anonymous social platform designed to foster genuine connection and expression by removing the pressures of personal identity. In an era where digital identities often lead to self-censorship and anxiety, Veil Shine offers a sanctuary where users can share thoughts, stories, and experiences without fear of judgment or repercussion tied to their real-world persona. The platform leverages advanced AI for content moderation, sentiment analysis, and dynamic content presentation, ensuring a safe, engaging, and truly anonymous user experience.

## 2. Vision

To create the world's most trusted and engaging anonymous social network, empowering individuals to express themselves freely, connect authentically, and explore diverse perspectives without the constraints of personal identity.

## 3. Goals

*   **Primary Goal**: Achieve a highly engaged user base that values genuine, anonymous interaction.
*   **Secondary Goals**:
    *   Ensure robust anonymity by design, making it architecturally impossible to link user activity to real-world identities.
    *   Maintain a safe and inclusive environment through proactive AI-driven content moderation and community guidelines.
    *   Provide a seamless and intuitive user experience for posting, interacting, and discovering content.
    *   Establish a sustainable monetization model that aligns with user privacy and platform values.
    *   Foster a unique sense of community where shared experiences, rather than identities, drive connection.

## 4. User Personas

### Persona 1: The Confider (Primary)
*   **Name**: Alex (anonymous handle)
*   **Age**: 18-35
*   **Motivation**: Seeks a safe space to share personal thoughts, fears, or experiences without judgment from friends, family, or professional networks. Values privacy and authenticity.
*   **Needs**: Easy, quick posting; assurance of anonymity; a supportive community; AI-driven sentiment analysis to understand reactions without direct confrontation.
*   **Pain Points**: Fear of judgment on traditional social media; difficulty finding genuine connection; anxiety about online reputation.

### Persona 2: The Explorer (Secondary)
*   **Name**: Sam (anonymous handle)
*   **Age**: 20-45
*   **Motivation**: Curious about diverse perspectives and experiences. Enjoys reading anonymous stories and engaging in thoughtful discussions. Values novelty and emotional depth.
*   **Needs**: A dynamic feed of interesting content; easy ways to react and comment; ability to filter/discover content by topic or sentiment; assurance of a moderated, respectful environment.
*   **Pain Points**: Overwhelmed by personal branding on other platforms; desire for content that isn't curated by algorithms based on personal data.

### Persona 3: The Contributor (Secondary)
*   **Name**: Jamie (anonymous handle)
*   **Age**: 25-50
*   **Motivation**: Enjoys contributing to discussions, offering advice, or sharing insights based on their own experiences. Finds satisfaction in helping others anonymously. Values the ability to impact without being identified.
*   **Needs**: Simple commenting and reply features; clear community guidelines; tools to report inappropriate content; recognition for helpful contributions (e.g., upvotes, badges) without revealing identity.
*   **Pain Points**: Trolls and negativity on other platforms; lack of meaningful engagement.

## 5. Functional Requirements

### 5.1. Anonymity & Privacy
*   **FR1.1**: Users MUST be able to create an account and interact with the platform without providing any personally identifiable information (PII) such as email, phone number, or real name.
*   **FR1.2**: User-generated content (posts, comments, reactions) MUST be disassociated from any persistent identifier that could link back to a real-world identity.
*   **FR1.3**: The platform MUST implement architectural safeguards (e.g., zero-knowledge proofs, secure multi-party computation, or similar) to ensure that even platform administrators cannot link user activity to real identities.
*   **FR1.4**: All user communications (direct messages) MUST be end-to-end encrypted using WebCrypto ECDH P-256 key agreement, HKDF derivation, and AES-256-GCM symmetric encryption. Key pairs are generated client-side with private keys stored non-extractably in IndexedDB. Mismatched or lost keys trigger a key-reset warning dialog, allowing key regeneration while older historical messages stay securely locked.
*   **FR1.5**: AI-modified media (e.g., image filters, voice modulation) MUST be clearly labeled as such to maintain transparency and prevent misinformation.
*   **FR1.6**: Users MUST have the option to generate a recovery passphrase for their account, which is stored client-side only and never transmitted to the server.

### 5.2. Content Creation & Interaction
*   **FR2.1**: Users MUST be able to create and publish anonymous text-based posts (confessions, stories, questions) up to a defined character limit.
*   **FR2.2**: Users MUST be able to attach AI-modified images or audio snippets to their posts, with clear labeling of AI modification.
*   **FR2.3**: Users MUST be able to comment anonymously on posts and other comments, forming threaded discussions.
*   **FR2.4**: Users MUST be able to react to posts and comments using a predefined set of anonymous reactions (e.g., upvote, downvote, emotional emojis).
*   **FR2.5**: Users MUST be able to report inappropriate content or behavior.

### 5.3. Content Discovery & Feed
*   **FR3.1**: Users MUST have a personalized feed of anonymous posts based on their interests and engagement patterns (without using PII).
*   **FR3.2**: Users MUST be able to explore content by categories, trending topics, or sentiment.
*   **FR3.3**: The platform MUST support searching for posts and topics anonymously.

### 5.4. AI Integration
*   **FR4.1**: AI MUST be used for proactive content moderation, identifying and flagging harmful, offensive, or policy-violating content.
*   **FR4.2**: AI MUST provide sentiment analysis on posts and comments, visible to the poster (e.g., 
