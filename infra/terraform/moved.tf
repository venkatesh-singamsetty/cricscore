moved {
  from = aws_lambda_function.match_api
  to   = module.match_api.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.score_update
  to   = module.score_update.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.onconnect
  to   = module.onconnect.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.ondisconnect
  to   = module.ondisconnect.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.broadcaster
  to   = module.broadcaster.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.storage_worker
  to   = module.storage_worker.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.chat_api
  to   = module.chat_api.aws_lambda_function.this
}

moved {
  from = aws_lambda_function.cognito_presignup
  to   = module.cognito_presignup.aws_lambda_function.this
}