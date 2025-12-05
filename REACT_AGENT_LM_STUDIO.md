# ReAct-Style Agent with LangChain.js + LM Studio

This guide explains how to build a **ReAct-style agent** in JavaScript using **LangChain.js** with a **local model running in LM Studio**.

Unlike OpenAI-style tool calling, **ReAct works with ANY model**, including ones that *do not support tool-calling natively*.  
The model produces reasoning steps → LangChain executes tools → model continues reasoning → final answer.

---

# ✅ Requirements

### Install dependencies:

```bash
npm install langchain @langchain/openai zod
```

### Enable LM Studio local server:

LM Studio → **Developer** → **Local Server** → **Enable**

Copy the API URL (usually):

```
http://127.0.0.1:1234/v1
```

---

# 📌 1. Connect LangChain to LM Studio

```ts
import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
  apiKey: "lm-studio",                 // dummy, required by LangChain
  baseURL: "http://127.0.0.1:1234/v1", // LM Studio local server
  model: "local-model",                // ignored by LM Studio
  temperature: 0,
});
```

---

# 📌 2. Define Tools

```ts
export const tools = {
  getWeather: async ({ city }) => {
    return `Weather in ${city}: 26°C, sunny ☀️`;
  },

  addNumbers: async ({ a, b }) => {
    return a + b;
  },
};
```

---

# 📌 3. ReAct Prompt Template

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";

export const reactPrompt = ChatPromptTemplate.fromTemplate(`
You are an intelligent assistant that can use tools.

TOOLS:
{tools}

Use this format:

Thought: what you think
Action: toolName
Action Input: JSON for the tool
Observation: tool result
Final Answer: final answer once done

Begin!

Question: {input}
`);
```

Tool descriptions:

```ts
export const toolDescriptions = Object.keys(tools)
  .map(name => `- ${name}(input: JSON)`)
  .join("\n");
```

---

# 📌 4. ReAct Agent Execution Loop

```ts
import { AIMessage, HumanMessage } from "@langchain/core/messages";

export async function runReAct(input) {
  let messages = [];
  let response;

  while (true) {
    const prompt = await reactPrompt.format({
      input,
      tools: toolDescriptions,
    });

    messages.push(new HumanMessage(prompt));

    response = await model.invoke(messages);

    const text = response.content;
    console.log("MODEL:", text);

    if (text.includes("Final Answer:")) {
      return text.split("Final Answer:")[1].trim();
    }

    const actionMatch = text.match(/Action:\s*(.*)/);
    const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\})/);

    if (!actionMatch || !inputMatch) {
      return "Could not understand tool call.";
    }

    const actionName = actionMatch[1].trim();
    const actionInput = JSON.parse(inputMatch[1]);

    console.log("TOOL CALL:", actionName, actionInput);

    const tool = tools[actionName];
    if (!tool) throw new Error(\`Unknown tool: \${actionName}\`);

    const result = await tool(actionInput);
    console.log("TOOL RESULT:", result);

    messages.push(new AIMessage(text));
    messages.push(new HumanMessage(\`Observation: \${result}\`));
  }
}
```

---

# 📌 5. Run the Agent

```ts
import { runReAct } from "./react-agent.js";

const answer = await runReAct("What's the weather in Barcelona?");
console.log("ANSWER:", answer);
```

---

# 🎉 Done!

You now have a **fully functioning ReAct agent** with:

✔ Any LM Studio model  
✔ Arbitrary JS tools  
✔ Multi-step reasoning  
✔ Loop-based tool execution  
✔ No need for native tool-calling support  

---

