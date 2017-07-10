# Webhooks Provisioning API

**Note to users of the provisioning API:** The bridge will only work in rooms that it is able to see. Invite the bridge bot (`@_webhook:yourdomain.com`) to the room prior to modifying or querying state.

View the API in [Postman](https://documenter.getpostman.com/view/1707443/matrix-webhooks/6fYShpU).

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

Creates a new webhook for a room.

**Inputs**

| Parameter | Description | Example |
| --------- | ----------- | ------- |
| roomId    | The room's internal identifier | `!cURbafjkfsMDVwdRDQ:matrix.org` |
| userId    | The user attempting to create the webhook | `@travis:t2l.io` |

**Successful Response (200)**

```
{
  "success": true,
  "id": "some_long_string",
  "url": "https://webhook.t2bot.io/api/v1/matrix/hook/some_long_string",
  "userId": "@travis:t2l.io",
  "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org"
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
      "url": "https://webhook.t2bot.io/api/v1/matrix/hook/some_long_string",
      "userId": "@travis:t2l.io",
      "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org"
    },
    {
      "id": "another_long_string",
      "url": "https://webhook.t2bot.io/api/v1/matrix/hook/another_long_string",
      "userId": "@turt2live:matrix.org",
      "roomId": "!cURbafjkfsMDVwdRDQ:matrix.org"
    }
  ]
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