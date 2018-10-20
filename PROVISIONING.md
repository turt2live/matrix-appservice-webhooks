# Webhooks Provisioning API

**Note to users of the provisioning API:** The bridge will only work in rooms that it is able to see. Invite the bridge bot (`@_webhook:yourdomain.com`) to the room prior to modifying or querying state.

## Endpoints

All endpoints use the following format for errors (anything not in the 2xx range):
```
{
  "success": false,
  "message": "Something went wrong"
}
```

All endpoints also require the query parameter `token` with the value being the secret in the bridge's configuration. If this token is missing (or not changed from the default), the error will appear as a generic permissions failure. Inspect the response code to determine the nature of the failure (ie: 400 is bad request, 500 is something broken on our end, 403 is wrong token).

### `PUT /api/v1/provision/{roomId}/hook?userId={userId}`

Creates a new incoming webhook for a room. Outgoing webhooks are not yet supported by the bridge.

**Inputs**

| Parameter | Description | Example |
| --------- | ----------- | ------- |
| roomId    | The room's internal identifier | `!cURbafjkfsMDVwdRDQ:matrix.org` |
| userId    | The user attempting to create the webhook | `@travis:t2l.io` |

*Request Body*:
```
{
  "label": "Optional label for the webhook"
}
```

**Successful Response (200)**

```
{
  "success": true,
  "id": "some_long_string",
  "url": "https://webhook.t2bot.io/api/v1/matrix/hook/some_long_string",
  "userId": "@travis:t2l.io",
  "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org",
  "type": "incoming"
}
```

**Possible Error Messages**

* `User does not have permission to manage webhooks in this room` - appears for invalid room, user, or simple permissions error.

### `GET /api/v1/provision/{roomId}/hooks?userId={userId}`

Lists the webhooks created for a room. Will return an empty collection if no webhooks are configured.

**Inputs**

| Parameter | Description | Example |
| --------- | ----------- | ------- |
| roomId    | The room's internal identifier | `!cURbafjkfsMDVwdRDQ:matrix.org` |
| userId    | The user attempting to view the webhooks | `@travis:t2l.io` |

**Successful Response (200)**

```
{
  "success": true,
  "results": [
    {
      "id": "some_long_string",
      "label": "First Webhook",
      "url": "https://webhook.t2bot.io/api/v1/matrix/hook/some_long_string",
      "userId": "@travis:t2l.io",
      "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org",
      "type": "incoming"
    },
    {
      "id": "another_long_string",
      "label": "Second Webhook",
      "url": "https://webhook.t2bot.io/api/v1/matrix/hook/another_long_string",
      "userId": "@turt2live:matrix.org",
      "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org",
      "type": "incoming"
    }
  ]
}
```

**Possible Error Messages**

* `User does not have permission to manage webhooks in this room` - appears for invalid room, user, or simple permissions error.

### `GET /api/v1/provision/{roomId}/hook/{hookId}?userId={userId}`

Gets the configuration for a given webhook in a room.

**Inputs**

| Parameter | Description | Example |
| --------- | ----------- | ------- |
| roomId    | The room's internal identifier | `!cURbafjkfsMDVwdRDQ:matrix.org` |
| hookId    | The hook ID to get the configuration of | `some_long_string` |
| userId    | The user attempting to view the webhooks | `@travis:t2l.io` |

**Successful Response (200)**

```
{
  "success": true,
  "id": "some_long_string",
  "label": "First Webhook",
  "url": "https://webhook.t2bot.io/api/v1/matrix/hook/some_long_string",
  "userId": "@travis:t2l.io",
  "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org",
  "type": "incoming"
}
```

### `PUT /api/v1/provision/{roomId}/hook/{hookId}?userId={userId}`

Updates the configuration for a webhook.

**Inputs**

| Parameter | Description | Example |
| --------- | ----------- | ------- |
| roomId    | The room's internal identifier | `!cURbafjkfsMDVwdRDQ:matrix.org` |
| hookId    | The hook ID to set the configuration of | `some_long_string` |
| userId    | The user attempting to view the webhooks | `@travis:t2l.io` |

*Request Body*:
```
{
  "label": "Optional label for the webhook"
}
```

**Successful Response (200)**

```
{
  "success": true,
  "id": "some_long_string",
  "label": "New Webhook Label",
  "url": "https://webhook.t2bot.io/api/v1/matrix/hook/some_long_string",
  "userId": "@travis:t2l.io",
  "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org",
  "type": "incoming"
}
```

**Possible Error Messages**

* `User does not have permission to manage webhooks in this room` - appears for invalid room, user, or simple permissions error.

### `DELETE /api/v1/provision/{roomId}/hook/{hookId}?userId={userId}`

Deletes a webhook, rendering it useless.

**Inputs**

| Parameter | Description | Example |
| --------- | ----------- | ------- |
| roomId    | The room's internal identifier | `!cURbafjkfsMDVwdRDQ:matrix.org` |
| hookId    | The hook ID to delete | `some_long_string` |
| userId    | The user attempting to delete the webhook | `@travis:t2l.io` |

**Successful Response (200)**

```
{
  "success": true
}
```

**Possible Error Messages**

* `User does not have permission to manage webhooks in this room` - appears for invalid room, user, or simple permissions error.
