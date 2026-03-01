import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
table = dynamodb.Table('invitations')


def handler(event, context):
    email = event['request']['userAttributes']['email']

    result = table.get_item(Key={'email': email})
    item = result.get('Item')

    if not item or item.get('status') != 'pending':
        raise Exception('No valid invitation found for this email.')

    event['response']['autoConfirmUser'] = True
    event['response']['autoVerifyEmail'] = True
    return event
