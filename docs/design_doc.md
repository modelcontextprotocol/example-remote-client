# Example Remote MCP Client

The goal of this project is to build an example remote MCP client. This should serve two purposes:
* Provide a public example implementation of MCP features for an MCP client
* Be a prototyping testbed for incoming MCP protocol changes (when paired with the existing example-remote-server project)

Some key technical properties of this are:
* It should be statically served, using open router's oauth-authenticated inference api
* It should have a conversational UI, with local storage for persistence
    * We need to support tool calling in the assistant turn, so it will need an agent loop
* It should make MCP connections directly from the browser
* It should support connection to many MCP servers simultaneously
* It should suuport the remote MCP oauth flows


## React

I think using React on the FE will be the best option. I'm not very opinionated about this, however there is a good reference library for mcp in react called [use-mcp](https://github.com/geelen/use-mcp) that might serve for good inspiration (a core limitation of this library is that the hook only supports a single MCP server) as it implements the oauth flows.

## Inference

We should use OpenRouter for inference, however we should try decouple the agent loop from open router directly. I think it would be good to have an InferenceProvider style react interface where we can use useContext to inherit an object that allows for inference (with tool invocations). It should also provide a llm list available from the current provider. This would mean that as other inference providers (like Anthropic/OpenAI/Google allow access to their api's via oauth users can leverage existing subscriptions/payment options instead of needing to sign up to OpenRouter).

## Conversations & Agent loop

We will want to allow for many conversations at once, each potentially running inference / tool calls concurrently. We should have some abstraction over persistence incase we want the messages to be stored somewhere other than local storage.

The agent loop should run inference via the inference context/provider mentioned above, with all MCP tools added as tools the LLM can call. If a response comes back with a tool call in it, we need to evaluate the tool call, add the tool result to the message list so far, and start running inference again. This should happen until the model decides not to call a tool

There should be a stop button that allows the user to interrupt the model

We don't need to support message streaming - just having an indication that the agent loop is running is enough, and when a conversation turn (or tool call finishes) in the agent loop we can present that.

## General note

This should be nice and modular - it will be a testbed for new features, so code that is well decoupled and extensible is key.