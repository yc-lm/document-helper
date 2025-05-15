const OpenAI = require("openai");
const http = require("http"); // 引入 http 模块

const client = new OpenAI({
    apiKey : "", // 在这里将 MOONSHOT_API_KEY 替换为你从 Kimi 开放平台申请的 API Key
    baseURL: "https://api.moonshot.cn/v1",
});

let messages = [
    {
        role: "system",
        content: "你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。同时，你会拒绝一切涉及恐怖主义，种族歧视，黄色暴力等问题的回答。Moonshot AI 为专有名词，不可翻译成其他语言。",
    },
];

async function chat(input) {
    console.log('input',input);
    messages.push({
        role: "user",
        content: input,
    });

    const completion = await client.chat.completions.create({
        model: "moonshot-v1-8k",
        messages: messages,
        temperature: 0.3,
    });

    const assistantMessage = completion.choices[0].message;
    //messages.push(assistantMessage);
    return assistantMessage.content;
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
    // 添加 CORS 响应头
    res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有域名跨域访问，生产环境建议指定具体域名
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理 OPTIONS 请求（预检请求）
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    if (req.method === 'POST' && req.url === '/chat') {
        let body = '';
        // 监听数据接收事件
        req.on('data', chunk => {
            body += chunk.toString();
        });
        // 监听请求结束事件
        req.on('end', async () => {
            try {
                const { question } = JSON.parse(body);
                const answer = await chat(question);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ answer }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// 移除原有的使用示例
// (async () => {
//     console.log(await chat("你好，我今年 27 岁。"));
//     console.log(await chat("你知道我今年几岁吗？"));
// })();
