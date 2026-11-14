FROM node:22-bookworm-slim

# Install system utilities, Bangla and emoji fonts, and official Google Chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    procps \
    curl \
    git \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    fonts-beng \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/trusted.gpg.d/google.gpg \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set up standard Hugging Face non-root user (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PORT=7860 \
    NODE_ENV=production

WORKDIR /home/user/app

# Copy package files and install dependencies
COPY --chown=user:user package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY --chown=user:user . .

EXPOSE 7860

CMD ["node", "server.mjs"]
