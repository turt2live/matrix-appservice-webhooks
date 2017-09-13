module.exports = (webhook, matrix) => {
  if (!webhook.attachments) return;
  html = "";
  webhook.format = "html"
  webhook.attachments.forEach(function (attachment){
    console.log(attachment)
    color = attachment.color || "#f7f7f7"
    //bar = `<font color='${color}'>▌</font>`
    html += (attachment.pretext) ? attachment.pretext+"<br/>" : ""

    if (attachment.author_name ) {
      html += `<small>`
      html += (attachment.author_icon) ? `<img src="${attachment.author_icon}" height="16" width="16"/> ` : ""
      html += (attachment.author_link) ? `<a href="${attachment.author_link}">${attachment.author_name}</a>` : attachment.author_name
      html += "</small><br/>"
    }

    html += `<blockquote style="border-color: ${color};">`
    if (attachment.title ) {
      html += `<h4>`
      html += (attachment.title_link)
        ? `<a href="${attachment.title_link}">${attachment.title}</a></h4>`
        : `${attachment.title}</h3>`
    }

    if (attachment.text)
      html += `${attachment.text}<br/>`

    if (attachment.fields && attachment.fields.length > 0) {
      attachment.fields.forEach(function (field){
        html += `<b>${field.title}</b><br/>${field.value}<br/>`
      })
    }

    if (attachment.footer) {
      html += `<small>`
      html += (attachment.footer_icon) ? `<img src="${attachment.footer_icon}" height="16" width="16"/> ` : ""
      html += attachment.footer
      html += "</small><br/>"
    }

    if (attachment.image_url)
      html += `<img src="${attachment.image_url}"/><br/>`

    html += "</blockquote>"
  })
  if (!matrix.event.body)
      matrix.event.body = html
  else
    matrix.event.body += html

};
