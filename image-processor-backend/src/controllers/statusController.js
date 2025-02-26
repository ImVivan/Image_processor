const Request = require('../models/Request');

exports.getStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await Request.findOne({ requestId }).populate('products');
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const totalProducts = request.products.length;
    const completedProducts = request.products.filter(p => p.status === 'completed').length;
    const failedProducts = request.products.filter(p => p.status === 'failed').length;

    return res.status(200).json({
      status: request.status,
      progress: {
        total: totalProducts,
        completed: completedProducts,
        failed: failedProducts,
        pending: totalProducts - completedProducts - failedProducts
      }
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return res.status(500).json({ message: 'Error checking status' });
  }
}; 