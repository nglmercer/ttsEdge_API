# TTS API for Streaming

A Text-to-Speech API service designed for streaming platforms integration.

## Prerequisites

* [Bun](https://bun.sh) (for installing dependencies and running the project)
* [OBS Studio](https://obsproject.com/) (for streaming) (Optional)
* [Firefox](https://www.mozilla.org/firefox/) with the [Multistream Live Interceptor](https://addons.mozilla.org/en-US/firefox/addon/multistream-live-interceptor/) extension

## Installation
- YOU CAN USE BUILD: 
  1. Download the latest release from the [Releases](https://github.com/nglmercer/ttsEdge_API/releases) page.
- OR 
- FROM SOURCE: 

1. Clone this repository:

   ```sh
   git clone https://github.com/nglmercer/ttsEdge_API.git
   cd ttsEdge_API
   ```

2. Install dependencies:

   ```sh
   bun install
   ```

## Usage

1. Start the development server:

   ```sh
   bun run dev
   ```

2. Open the app in your browser:

   ```
   http://localhost:9001
   ```

3. Set up your webhook endpoint:

   ```
   http://localhost:9001/webhook
   ```

4. Install and configure the **Multistream Live Interceptor** Firefox extension.

5. Use the [local TTS widget](https://nglmercer.github.io/multistreamASTRO/widgets/localtts/) with OBS
   – or –
   Build your own widget based on this [example](https://github.com/nglmercer/multistreamASTRO/blob/master/src/pages/widgets/localtts).

## Custom Widgets

You can create your own widgets by following the example in:

```
src/pages/widgets/localtts.astro
```

## License

MIT License

---

Would you like me to:

1. Make it **more professional (for GitHub public release)** with badges, description, and screenshot placeholders,
2. Keep it **simple and minimal (for internal use)**, or
3. Create **both versions**?
